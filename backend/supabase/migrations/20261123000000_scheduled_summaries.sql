begin;

-- Private aggregation is shared by authenticated reports and the trusted monthly scheduler.
create function public.account_transaction_totals(p_user_id uuid, p_from timestamptz, p_to timestamptz, p_business boolean default null)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(summary) order by currency), '[]'::jsonb) from (
    select currency,
      count(*) filter(where status = 'SETTLED') as settled_count,
      count(*) filter(where status = 'PENDING') as pending_count,
      count(*) filter(where status = 'DECLINED') as declined_count,
      count(*) filter(where status = 'REVERSED') as reversed_count,
      coalesce(sum(amount_minor) filter(where status = 'SETTLED'), 0)::text as settled_amount_minor,
      coalesce(sum(fx_ngn_amount) filter(where status = 'SETTLED'), 0)::text as fx_ngn_amount_minor,
      coalesce(sum(pool_amount) filter(where status = 'SETTLED'), 0)::text as pool_amount_minor
    from public.transactions where user_id = p_user_id and created_at >= p_from and created_at < p_to
      and (p_business is null or is_business_expense = p_business)
    group by currency
  ) summary;
$$;
revoke all on function public.account_transaction_totals(uuid,timestamptz,timestamptz,boolean) from public, anon, authenticated;

create or replace function public.transaction_summary(p_from timestamptz, p_to timestamptz, p_business boolean default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare account_id uuid := public.require_account();
begin
  if p_from is null or p_to is null or p_from >= p_to then raise exception 'Invalid period' using errcode = '22023'; end if;
  return public.account_transaction_totals(account_id, p_from, p_to, p_business);
end;
$$;

-- Workers catch up the last completed UTC month, in bounded batches, once per opted-in account.
create function public.schedule_monthly_summary_emails(p_now timestamptz default now(), p_limit integer default 100)
returns integer language plpgsql security definer set search_path = '' as $$
declare boundary timestamptz; start_date timestamptz; month_name text; job_key text;
  recipient record; summary public.monthly_summaries; queued integer := 0;
begin
  if p_now is null or p_limit is null or p_limit not between 1 and 100 then raise exception 'Invalid schedule batch' using errcode = '22023'; end if;
  boundary := date_trunc('month', p_now at time zone 'UTC') at time zone 'UTC';
  start_date := (boundary at time zone 'UTC' - interval '1 month') at time zone 'UTC';
  month_name := to_char(start_date at time zone 'UTC', 'YYYY-MM');
  job_key := 'scheduled-summary-' || month_name;
  for recipient in
    select s.user_id, u.email from public.user_settings s join auth.users u on u.id = s.user_id
    where s.monthly_summary_email and u.email_confirmed_at is not null and u.email is not null
      and not exists(select 1 from public.email_jobs j where j.user_id = s.user_id and j.idempotency_key = job_key)
    order by s.user_id for update of s skip locked limit p_limit
  loop
    perform pg_advisory_xact_lock(hashtextextended(recipient.user_id::text || ':summary:' || month_name, 0));
    select * into summary from public.monthly_summaries where user_id = recipient.user_id and month = month_name;
    if summary.id is null then
      insert into public.monthly_summaries(user_id, month, totals)
      values(recipient.user_id, month_name, public.account_transaction_totals(recipient.user_id, start_date, boundary, null))
      returning * into summary;
    end if;
    insert into public.email_jobs(user_id, summary_id, recipient, payload, idempotency_key)
    values(recipient.user_id, summary.id, recipient.email,
      jsonb_build_object('month', summary.month, 'totals', summary.totals, 'generated_at', summary.created_at), job_key)
    on conflict(user_id, idempotency_key) do nothing;
    if found then queued := queued + 1; end if;
  end loop;
  return queued;
end;
$$;
revoke all on function public.schedule_monthly_summary_emails(timestamptz,integer) from public, anon, authenticated;
grant execute on function public.schedule_monthly_summary_emails(timestamptz,integer) to service_role;

create or replace function public.queue_summary_email(p_summary_id uuid, p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare account_id uuid := public.require_account(); summary public.monthly_summaries; job public.email_jobs;
begin
  if p_idempotency_key like 'scheduled-summary-%' then raise exception 'Reserved email key' using errcode = '22023'; end if;
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

-- An opt-out cancels automatic jobs before a new attempt; explicit manual requests remain valid.
create or replace function public.claim_email_jobs(p_limit integer default 4, p_lease_seconds integer default 120)
returns setof public.email_jobs language plpgsql security definer set search_path = '' as $$
begin
  if p_limit is null or p_lease_seconds is null or p_limit not between 1 and 20 or p_lease_seconds not between 30 and 600
  then raise exception 'Invalid claim' using errcode = '22023'; end if;
  update public.email_jobs j set status = 'FAILED', last_error_code = 'monthly_email_disabled',
    locked_until = null, claim_token = null, updated_at = now()
  where j.idempotency_key like 'scheduled-summary-%'
    and (j.status = 'QUEUED' or (j.status = 'PROCESSING' and j.locked_until < now()))
    and not exists(select 1 from public.user_settings s join auth.users u on u.id = s.user_id
      where s.user_id = j.user_id and s.monthly_summary_email and u.email_confirmed_at is not null
        and u.email = j.recipient);
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

create or replace function public.backend_readiness()
returns text language sql immutable set search_path = '' as $$ select '20261123000000'::text $$;
commit;
