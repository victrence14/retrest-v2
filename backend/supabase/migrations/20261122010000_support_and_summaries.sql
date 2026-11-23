begin;

-- RETREST's own asynchronous staff inbox is the support transport.
-- Membership is assigned by a trusted administrator, never by application users.
create table public.support_agents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  disabled_at timestamptz
);
create table public.support_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null check (char_length(subject) between 1 and 160),
  status text not null default 'OPEN' check (status in ('OPEN', 'CLOSED')),
  idempotency_key text not null check (idempotency_key ~ '^[A-Za-z0-9_-]{8,128}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, idempotency_key)
);
create index support_threads_user_page_idx on public.support_threads(user_id, created_at desc, id desc);
create index support_inbox_idx on public.support_threads(status, created_at desc, id desc);
create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.support_threads(id) on delete cascade,
  author_user_id uuid not null references auth.users(id),
  sender_role text not null check (sender_role in ('CUSTOMER', 'AGENT')),
  body text not null check (char_length(body) between 1 and 4000),
  idempotency_key text not null check (idempotency_key ~ '^[A-Za-z0-9_-]{8,128}$'),
  created_at timestamptz not null default now(),
  unique(author_user_id, idempotency_key)
);
create index support_messages_page_idx on public.support_messages(thread_id, created_at desc, id desc);
create function public.is_support_agent()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_account_session_active() and exists(
    select 1 from public.support_agents where user_id = auth.uid() and disabled_at is null
  );
$$;
create function public.can_read_support_thread(p_thread_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_account_session_active() and exists(
    select 1 from public.support_threads where id = p_thread_id
      and (user_id = auth.uid() or public.is_support_agent())
  );
$$;
create function public.create_support_thread(p_subject text, p_body text, p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare account_id uuid := public.require_account(); thread public.support_threads; message public.support_messages;
begin
  perform pg_advisory_xact_lock(hashtextextended(account_id::text || ':support:' || p_idempotency_key, 0));
  select * into thread from public.support_threads where user_id = account_id and idempotency_key = p_idempotency_key;
  if thread.id is not null then
    select * into message from public.support_messages where thread_id = thread.id and idempotency_key = p_idempotency_key;
    if thread.subject <> btrim(p_subject) or message.body <> btrim(p_body)
    then raise exception 'Idempotency conflict' using errcode = '22023'; end if;
    return jsonb_build_object('thread', to_jsonb(thread) - 'idempotency_key',
      'message', to_jsonb(message) - 'idempotency_key' - 'author_user_id', 'replayed', true);
  end if;
  insert into public.support_threads(user_id, subject, idempotency_key)
  values(account_id, btrim(p_subject), p_idempotency_key) returning * into thread;
  insert into public.support_messages(thread_id, author_user_id, sender_role, body, idempotency_key)
  values(thread.id, account_id, 'CUSTOMER', btrim(p_body), p_idempotency_key) returning * into message;
  return jsonb_build_object('thread', to_jsonb(thread) - 'idempotency_key',
    'message', to_jsonb(message) - 'idempotency_key' - 'author_user_id', 'replayed', false);
end;
$$;
create function public.add_support_message(p_thread_id uuid, p_body text, p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare account_id uuid := public.require_account(); thread public.support_threads;
  message public.support_messages; sender text;
begin
  select * into thread from public.support_threads where id = p_thread_id for update;
  if thread.id is null or not public.can_read_support_thread(thread.id)
  then raise exception 'Thread unavailable' using errcode = 'P0002'; end if;
  perform pg_advisory_xact_lock(hashtextextended(account_id::text || ':message:' || p_idempotency_key, 0));
  select * into message from public.support_messages where author_user_id = account_id and idempotency_key = p_idempotency_key;
  if message.id is not null then
    if message.thread_id <> p_thread_id or message.body <> btrim(p_body)
    then raise exception 'Idempotency conflict' using errcode = '22023'; end if;
    return jsonb_build_object('message', to_jsonb(message) - 'idempotency_key' - 'author_user_id', 'replayed', true);
  end if;
  if thread.status <> 'OPEN' then raise exception 'Thread is closed' using errcode = 'P0001'; end if;
  sender := case when thread.user_id = account_id then 'CUSTOMER' else 'AGENT' end;
  insert into public.support_messages(thread_id, author_user_id, sender_role, body, idempotency_key)
  values(thread.id, account_id, sender, btrim(p_body), p_idempotency_key) returning * into message;
  update public.support_threads set updated_at = now() where id = thread.id;
  if sender = 'AGENT' then
    insert into public.account_notifications(user_id, title, message, resource_type, resource_id)
    values(thread.user_id, 'Support replied', 'There is a new reply in your support conversation.', 'support', thread.id);
  end if;
  return jsonb_build_object('message', to_jsonb(message) - 'idempotency_key' - 'author_user_id', 'replayed', false);
end;
$$;
create function public.set_support_thread_status(p_thread_id uuid, p_status text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare account_id uuid := public.require_account(); thread public.support_threads;
begin
  if p_status not in ('OPEN', 'CLOSED') then raise exception 'Invalid status' using errcode = '22023'; end if;
  update public.support_threads set status = p_status, updated_at = now()
  where id = p_thread_id and public.can_read_support_thread(id) returning * into thread;
  if thread.id is null then raise exception 'Thread unavailable' using errcode = 'P0002'; end if;
  return to_jsonb(thread) - 'idempotency_key';
end;
$$;

create table public.monthly_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month text not null check (month ~ '^[1-9][0-9]{3}-(0[1-9]|1[0-2])$'),
  totals jsonb not null check (jsonb_typeof(totals) = 'array'),
  created_at timestamptz not null default now(),
  unique(user_id, month)
);
create index monthly_summaries_page_idx on public.monthly_summaries(user_id, created_at desc, id desc);
create function public.generate_monthly_summary(p_month text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare account_id uuid := public.require_account(); summary public.monthly_summaries; start_date date;
begin
  if p_month !~ '^[1-9][0-9]{3}-(0[1-9]|1[0-2])$' then raise exception 'Invalid month' using errcode = '22023'; end if;
  start_date := (p_month || '-01')::date;
  -- A summary is an immutable snapshot. Repeated generation returns that same snapshot.
  perform pg_advisory_xact_lock(hashtextextended(account_id::text || ':summary:' || p_month, 0));
  select * into summary from public.monthly_summaries where user_id = account_id and month = p_month;
  if summary.id is null then
    insert into public.monthly_summaries(user_id, month, totals)
    values(account_id, p_month, public.transaction_summary(
      start_date::timestamp at time zone 'UTC', (start_date + interval '1 month') at time zone 'UTC', null))
    returning * into summary;
  end if;
  return to_jsonb(summary);
end;
$$;

alter table public.support_agents enable row level security;
alter table public.support_threads enable row level security;
alter table public.support_messages enable row level security;
alter table public.monthly_summaries enable row level security;
revoke all on public.support_agents, public.support_threads, public.support_messages, public.monthly_summaries
  from public, anon, authenticated;
grant all on public.support_agents, public.support_threads, public.support_messages, public.monthly_summaries to service_role;
grant select on public.support_threads, public.monthly_summaries to authenticated;
grant select(id, thread_id, sender_role, body, created_at) on public.support_messages to authenticated;
create policy support_threads_read on public.support_threads for select to authenticated
  using (public.can_read_support_thread(id));
create policy support_messages_read on public.support_messages for select to authenticated
  using (public.can_read_support_thread(thread_id));
create policy monthly_summaries_read on public.monthly_summaries for select to authenticated
  using (user_id = (select auth.uid()) and (select public.is_account_session_active()));
revoke all on function public.is_support_agent(), public.can_read_support_thread(uuid),
  public.create_support_thread(text,text,text), public.add_support_message(uuid,text,text),
  public.set_support_thread_status(uuid,text), public.generate_monthly_summary(text) from public, anon, authenticated;
grant execute on function public.is_support_agent(), public.can_read_support_thread(uuid),
  public.create_support_thread(text,text,text), public.add_support_message(uuid,text,text),
  public.set_support_thread_status(uuid,text), public.generate_monthly_summary(text) to authenticated;

commit;
