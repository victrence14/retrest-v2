begin;

-- API replicas enqueue; separate workers claim with SKIP LOCKED and renewable leases.
-- The provider's acceptance is separate from a verified delivery event.
create table public.email_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  summary_id uuid not null references public.monthly_summaries(id) on delete cascade,
  recipient text not null,
  payload jsonb not null,
  idempotency_key text not null check (idempotency_key ~ '^[A-Za-z0-9_-]{8,128}$'),
  status text not null default 'QUEUED' check (status in ('QUEUED', 'PROCESSING', 'ACCEPTED', 'DELIVERED', 'BOUNCED', 'FAILED')),
  attempts integer not null default 0 check (attempts between 0 and 5),
  available_at timestamptz not null default now(),
  first_attempt_at timestamptz,
  locked_until timestamptz,
  claim_token uuid,
  provider_message_id text unique,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, idempotency_key)
);
create index email_jobs_claim_idx on public.email_jobs(status, available_at, locked_until);
create index email_jobs_user_idx on public.email_jobs(user_id, created_at desc, id desc);
create table public.email_provider_events (
  event_id text primary key check (char_length(event_id) between 1 and 200),
  provider_message_id text not null,
  status text not null check (status in ('DELIVERED', 'BOUNCED', 'FAILED')),
  payload_hash text not null check (payload_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now()
);
create index email_events_message_idx on public.email_provider_events(provider_message_id);
create function public.queue_summary_email(p_summary_id uuid, p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare account_id uuid := public.require_account(); summary public.monthly_summaries; job public.email_jobs;
begin
  perform pg_advisory_xact_lock(hashtextextended(account_id::text || ':email:' || p_idempotency_key, 0));
  select * into job from public.email_jobs where user_id = account_id and idempotency_key = p_idempotency_key;
  if job.id is not null then
    if job.summary_id <> p_summary_id then raise exception 'Idempotency conflict' using errcode = '22023'; end if;
  else
    select * into summary from public.monthly_summaries where id = p_summary_id and user_id = account_id;
    if summary.id is null then raise exception 'Summary unavailable' using errcode = 'P0002'; end if;
    insert into public.email_jobs(user_id, summary_id, recipient, payload, idempotency_key)
    values(account_id, summary.id, public.account_email(),
      jsonb_build_object('month', summary.month, 'totals', summary.totals, 'generated_at', summary.created_at), p_idempotency_key)
    returning * into job;
  end if;
  return jsonb_build_object('id', job.id, 'summary_id', job.summary_id, 'status', job.status,
    'attempts', job.attempts, 'created_at', job.created_at, 'updated_at', job.updated_at);
end;
$$;
create function public.claim_email_jobs(p_limit integer default 4, p_lease_seconds integer default 120)
returns setof public.email_jobs language plpgsql security definer set search_path = '' as $$
begin
  if p_limit not between 1 and 20 or p_lease_seconds not between 30 and 600
  then raise exception 'Invalid claim' using errcode = '22023'; end if;
  -- Resend retains idempotency keys for 24 hours. Never retry an uncertain send after that window.
  update public.email_jobs set status = 'FAILED', last_error_code = 'delivery_window_expired',
    locked_until = null, claim_token = null, updated_at = now()
  where first_attempt_at < now() - interval '23 hours'
    and (status = 'QUEUED' or (status = 'PROCESSING' and locked_until < now()));
  update public.email_jobs set status = 'FAILED', last_error_code = 'attempts_exhausted',
    locked_until = null, claim_token = null, updated_at = now()
  where attempts >= 5 and (status = 'QUEUED' or (status = 'PROCESSING' and locked_until < now()));
  return query
    with candidates as (
      select id from public.email_jobs where attempts < 5
        and ((status = 'QUEUED' and available_at <= now()) or (status = 'PROCESSING' and locked_until < now()))
      order by available_at, id for update skip locked limit p_limit
    )
    update public.email_jobs j set status = 'PROCESSING', attempts = attempts + 1,
      first_attempt_at = coalesce(first_attempt_at, now()),
      claim_token = gen_random_uuid(), locked_until = now() + make_interval(secs => p_lease_seconds), updated_at = now()
    from candidates c where j.id = c.id returning j.*;
end;
$$;
create function public.finish_email_job(p_job_id uuid, p_claim_token uuid, p_provider_message_id text,
  p_error_code text default null, p_retryable boolean default true)
returns boolean language plpgsql security definer set search_path = '' as $$
declare job public.email_jobs; delivery_status text;
begin
  select * into job from public.email_jobs
  where id = p_job_id and status = 'PROCESSING' and claim_token = p_claim_token and locked_until > now()
  for update;
  if job.id is null then return false; end if;
  if p_provider_message_id is not null then
    -- The webhook may arrive before the worker gets the HTTP response.
    select status into delivery_status from public.email_provider_events
    where provider_message_id = p_provider_message_id
    order by case status when 'BOUNCED' then 3 when 'FAILED' then 2 else 1 end desc limit 1;
    update public.email_jobs set status = coalesce(delivery_status, 'ACCEPTED'),
      provider_message_id = p_provider_message_id, locked_until = null, claim_token = null,
      last_error_code = null, updated_at = now() where id = job.id;
  else
    update public.email_jobs set
      status = case when not p_retryable or attempts >= 5 then 'FAILED' else 'QUEUED' end,
      available_at = now() + make_interval(secs => least(900, (power(2, attempts)::int * 30))),
      locked_until = null, claim_token = null, last_error_code = left(p_error_code, 80), updated_at = now()
    where id = job.id;
  end if;
  return true;
end;
$$;
create function public.record_email_event(p_event_id text, p_provider_message_id text, p_status text, p_payload_hash text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare previous public.email_provider_events; final_status text;
begin
  if p_status not in ('DELIVERED', 'BOUNCED', 'FAILED')
  then raise exception 'Invalid delivery event' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('email-event:' || p_event_id, 0));
  select * into previous from public.email_provider_events where event_id = p_event_id;
  if previous.event_id is not null then
    if previous.provider_message_id <> p_provider_message_id or previous.status <> p_status or previous.payload_hash <> p_payload_hash
    then raise exception 'Event conflict' using errcode = '22023'; end if;
    return true;
  end if;
  insert into public.email_provider_events(event_id, provider_message_id, status, payload_hash)
  values(p_event_id, p_provider_message_id, p_status, p_payload_hash);
  select status into final_status from public.email_provider_events where provider_message_id = p_provider_message_id
  order by case status when 'BOUNCED' then 3 when 'FAILED' then 2 else 1 end desc limit 1;
  update public.email_jobs set status = final_status, updated_at = now()
  where provider_message_id = p_provider_message_id and status in ('ACCEPTED', 'DELIVERED', 'BOUNCED', 'FAILED');
  return true;
end;
$$;

alter table public.email_jobs enable row level security;
alter table public.email_provider_events enable row level security;
revoke all on public.email_jobs, public.email_provider_events from public, anon, authenticated;
grant all on public.email_jobs, public.email_provider_events to service_role;
grant select(id, user_id, summary_id, status, attempts, created_at, updated_at) on public.email_jobs to authenticated;
create policy email_jobs_read on public.email_jobs for select to authenticated
  using (user_id = (select auth.uid()) and (select public.is_account_session_active()));
revoke all on function public.queue_summary_email(uuid,text), public.claim_email_jobs(integer,integer),
  public.finish_email_job(uuid,uuid,text,text,boolean), public.record_email_event(text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.queue_summary_email(uuid,text) to authenticated;
grant execute on function public.claim_email_jobs(integer,integer), public.finish_email_job(uuid,uuid,text,text,boolean),
  public.record_email_event(text,text,text,text) to service_role;

-- Public readiness reports a schema revision only; it contains no account data.
create function public.backend_readiness()
returns text language sql immutable set search_path = '' as $$ select '20261122020000'::text $$;
revoke all on function public.backend_readiness() from public;
grant execute on function public.backend_readiness() to anon, authenticated, service_role;

commit;
