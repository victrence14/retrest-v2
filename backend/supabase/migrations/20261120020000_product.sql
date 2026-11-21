begin;

-- Retrest product phase: merchant rules, ownership records, devices and support.
-- Financial ledger primitives (wallets, cards, pools, transactions) live in the
-- fintech migration; this migration adds the product-owned domain records.

-- Starter subscriptions become the merchant-rule record owned by the product.
alter table public.subscriptions
  add column if not exists merchant_name text,
  add column if not exists merchant_descriptor text,
  add column if not exists max_amount_minor bigint not null default 0,
  add column if not exists billing_cycle text not null default 'MONTHLY',
  add column if not exists next_billing_date timestamptz not null default now(),
  add column if not exists is_business_expense boolean not null default false,
  add column if not exists needs_review boolean not null default false,
  add column if not exists plan_name text not null default '',
  add column if not exists status text not null default 'ACTIVE';

-- The approved maximum defaults to the expected amount until the user raises it.
update public.subscriptions
   set max_amount_minor = amount_minor
 where max_amount_minor = 0;
update public.subscriptions
   set status = case when active then 'ACTIVE' else 'PAUSED' end;

alter table public.subscriptions
  add constraint subscriptions_billing_cycle_check
     check (billing_cycle in ('MONTHLY', 'YEARLY'));
alter table public.subscriptions
  add constraint subscriptions_status_check
     check (status in ('ACTIVE', 'PAUSED'));

create unique index subscriptions_user_merchant_descriptor_uidx
  on public.subscriptions(user_id, merchant_descriptor);
create index subscriptions_user_next_billing_idx
  on public.subscriptions(user_id, next_billing_date);

create table public.merchant_rules (
  id uuid primary key default gen_random_uuid(),
  merchant_descriptor text not null unique,
  merchant_name text not null,
  default_amount_minor bigint not null default 0,
  default_currency text not null default 'NGN' check (default_currency in ('NGN', 'USD')),
  max_amount_minor bigint not null default 0,
  require_review boolean not null default false,
  split_payments_enabled boolean not null default false,
  fallback_funding_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_name text not null default '',
  challenge_token text not null default '',
  challenge_expires_at timestamptz,
  attempts integer not null default 0,
  verified_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index public_user_devices_user_id_idx on public.user_devices(user_id);

create table public.support_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null default '',
  subscription_id uuid references public.subscriptions(id) on delete set null,
  transaction_id uuid references public.transactions(id) on delete set null,
  status text not null default 'OPEN' check (status in ('OPEN', 'PENDING', 'RESOLVED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index public_support_threads_user_id_idx on public.support_threads(user_id);

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.support_threads(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index public_support_messages_thread_id_idx on public.support_messages(thread_id);

alter table public.merchant_rules enable row level security;
alter table public.user_devices enable row level security;
alter table public.support_threads enable row level security;
alter table public.support_messages enable row level security;

revoke all on public.merchant_rules, public.user_devices, public.support_threads, public.support_messages from anon, authenticated;
grant select, insert, update, delete on public.merchant_rules to authenticated;
grant select, insert, update, delete on public.user_devices to authenticated;
grant select, insert, update, delete on public.support_threads to authenticated;
grant select, insert, update, delete on public.support_messages to authenticated;
grant all on public.merchant_rules, public.user_devices, public.support_threads, public.support_messages to service_role;

create policy "Read own merchant rules" on public.merchant_rules for select to authenticated
  using ((select auth.uid()) in (select user_id from public.subscriptions where merchant_descriptor = merchant_rules.merchant_descriptor));
create policy "Create own merchant rules" on public.merchant_rules for insert to authenticated
  with check ((select auth.uid()) in (select user_id from public.subscriptions where merchant_descriptor = merchant_rules.merchant_descriptor));
create policy "Update own merchant rules" on public.merchant_rules for update to authenticated
  using ((select auth.uid()) in (select user_id from public.subscriptions where merchant_descriptor = merchant_rules.merchant_descriptor))
  with check ((select auth.uid()) in (select user_id from public.subscriptions where merchant_descriptor = merchant_rules.merchant_descriptor));

create policy "Read own devices" on public.user_devices for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Create own devices" on public.user_devices for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Update own devices" on public.user_devices for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Delete own devices" on public.user_devices for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "Read own support threads" on public.support_threads for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Create own support threads" on public.support_threads for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Update own support threads" on public.support_threads for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "Read own support messages" on public.support_messages for select to authenticated
  using (
    exists (
      select 1 from public.support_threads t
      where t.id = support_messages.thread_id
        and (select auth.uid()) = t.user_id
    )
  );
create policy "Insert own support messages" on public.support_messages for insert to authenticated
  with check (
    exists (
      select 1 from public.support_threads t
      where t.id = support_messages.thread_id
        and (select auth.uid()) = t.user_id
    )
  );

-- Invitation lifecycle for shared pools (invite_token already exists on split_pools).
alter table public.split_pools
  add column if not exists invite_expires_at timestamptz,
  add column if not exists invite_revoked_at timestamptz;

create table public.pool_contributions (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.split_pools(id) on delete cascade,
  member_id uuid references public.pool_members(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null default 'NGN' check (currency in ('NGN', 'USD')),
  status text not null default 'PENDING' check (status in ('PENDING', 'SETTLED', 'FAILED')),
  reference text not null,
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  unique (pool_id, reference)
);
create index public_pool_contributions_user_idx on public.pool_contributions(user_id, created_at desc);
create index public_pool_contributions_pool_idx on public.pool_contributions(pool_id, created_at desc);

alter table public.pool_contributions enable row level security;
revoke all on public.pool_contributions from anon, authenticated;
grant select, insert, update on public.pool_contributions to authenticated;
grant all on public.pool_contributions to service_role;

create policy "Read own contributions" on public.pool_contributions for select to authenticated
  using (
    (select auth.uid()) = user_id
    or public.pool_access(pool_id) = 'HOST'
  );
create policy "Create own contributions" on public.pool_contributions for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and public.pool_access(pool_id) <> 'NONE'
  );
create policy "Update own contributions" on public.pool_contributions for update to authenticated
  using (
    (select auth.uid()) = user_id
    or public.pool_access(pool_id) = 'HOST'
  );

-- Spend summaries with tracked email delivery.
create table public.spend_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month text not null check (month ~ '^[0-9]{4}-[0-9]{2}$'),
  totals jsonb not null default '{}'::jsonb,
  highlights jsonb not null default '[]'::jsonb,
  review_flags jsonb not null default '[]'::jsonb,
  email_status text not null default 'NOT_SENT' check (email_status in ('NOT_SENT', 'QUEUED', 'SENT', 'FAILED')),
  email_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, month)
);
alter table public.spend_summaries enable row level security;
revoke all on public.spend_summaries from anon, authenticated;
grant select, insert, update on public.spend_summaries to authenticated;
grant all on public.spend_summaries to service_role;
create policy "Read own spend summaries" on public.spend_summaries for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Create own spend summaries" on public.spend_summaries for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Update own spend summaries" on public.spend_summaries for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Consented recurring pool contributions.
create table public.pool_schedules (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.split_pools(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null default 'NGN' check (currency in ('NGN', 'USD')),
  cadence text not null default 'MONTHLY' check (cadence in ('MONTHLY')),
  next_run_at timestamptz not null default now(),
  consent_at timestamptz not null default now(),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'PAUSED', 'CANCELLED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pool_id, user_id)
);
alter table public.pool_schedules enable row level security;
revoke all on public.pool_schedules from anon, authenticated;
grant select, insert, update on public.pool_schedules to authenticated;
grant all on public.pool_schedules to service_role;
create policy "Read own pool schedules" on public.pool_schedules for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Create own pool schedules" on public.pool_schedules for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Update own pool schedules" on public.pool_schedules for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Idempotent product event log consumed by background jobs (service role only).
create table public.product_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.product_events enable row level security;
revoke all on public.product_events from anon, authenticated;
grant all on public.product_events to service_role;

-- Public invitation lookup: only safe pool metadata is exposed for a token.
create function public.pool_invite(p_token text)
returns table (
  pool_id uuid,
  name text,
  target_amount bigint,
  currency text,
  status text,
  expires_at timestamptz,
  revoked_at timestamptz
)
language sql security definer set search_path = '' as $$
  select sp.id, sp.name, sp.target_amount, sp.currency, sp.status, sp.invite_expires_at, sp.invite_revoked_at
    from public.split_pools sp
   where sp.invite_token = p_token;
$$;
revoke all on function public.pool_invite(text) from public;
grant execute on function public.pool_invite(text) to anon, authenticated;

-- Accepting binds the signed-in verified identity to the invited member row.
create function public.accept_pool_invite(p_token text)
returns table (pool_id uuid, member_id uuid, share_amount bigint, payment_status text)
language plpgsql security definer set search_path = '' as $$
declare
  v_pool public.split_pools%rowtype;
  v_email text;
  v_member public.pool_members%rowtype;
begin
  select * into v_pool from public.split_pools sp where sp.invite_token = p_token;
  if not found then
    raise exception 'invite_not_found';
  end if;
  if v_pool.invite_revoked_at is not null then
    raise exception 'invite_revoked';
  end if;
  if v_pool.invite_expires_at is not null and v_pool.invite_expires_at < now() then
    raise exception 'invite_expired';
  end if;
  select u.email into v_email from auth.users u where u.id = auth.uid();
  select * into v_member from public.pool_members pm
    where pm.pool_id = v_pool.id
      and lower(pm.email) = lower(coalesce(v_email, ''));
  if not found then
    raise exception 'invite_email_mismatch';
  end if;
  if v_member.user_id is not null and v_member.user_id <> auth.uid() then
    raise exception 'invite_already_claimed';
  end if;
  update public.pool_members pm set user_id = auth.uid() where pm.id = v_member.id;
  return query select v_pool.id, v_member.id, v_member.share_amount, v_member.payment_status;
end;
$$;
revoke all on function public.accept_pool_invite(text) from public;
grant execute on function public.accept_pool_invite(text) to authenticated;

commit;
