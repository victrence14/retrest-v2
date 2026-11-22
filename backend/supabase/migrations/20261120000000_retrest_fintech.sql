begin;

-- RETREST fintech ledger: wallets, cards, pools, transactions and notifications.
-- Merchant-rule fields on public.subscriptions are product-owned and are added
-- by the product migration that follows this one.

-- Wallet: one owner row holding NGN + USD balances and auto-FX state.
create table public.wallets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  ngn_balance bigint not null default 0 check (ngn_balance >= 0),
  usd_balance bigint not null default 0 check (usd_balance >= 0),
  auto_fx_enabled boolean not null default true,
  fx_converted_ngn bigint not null default 0,
  updated_at timestamptz not null default now()
);

-- Master virtual card for the owner (masked details live behind the issuer).
create table public.virtual_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  masked_pan text not null,
  expiry text not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'FROZEN')),
  provider_card_id text not null unique,
  provider_customer_id text not null,
  created_at timestamptz not null default now()
);

-- Shared split pool for one subscription.
create table public.split_pools (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null unique references public.subscriptions(id) on delete cascade,
  host_user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  pool_balance bigint not null default 0 check (pool_balance >= 0),
  target_amount bigint not null check (target_amount > 0),
  currency text not null default 'NGN' check (currency in ('NGN', 'USD')),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'PAID')),
  fallback_enabled boolean not null default true,
  invite_token text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pool_members (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.split_pools(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  name text not null,
  email text not null,
  share_amount bigint not null check (share_amount > 0),
  payment_status text not null default 'PENDING'
    check (payment_status in ('PAID', 'PENDING', 'OVERDUE')),
  auto_debit_scheduled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pool_id, email)
);

create trigger split_pools_updated_at before update on public.split_pools
for each row execute function public.touch_updated_at();
create trigger pool_members_updated_at before update on public.pool_members
for each row execute function public.touch_updated_at();

-- Authorization ledger: one immutable decision per provider authorization id.
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  authorization_id text not null unique,
  user_id uuid not null references public.profiles(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  merchant_name text not null,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null default 'NGN' check (currency in ('NGN', 'USD')),
  status text not null,
  decline_reason text,
  receipt_url text,
  fx_ngn_amount bigint not null default 0,
  pool_amount bigint not null default 0,
  http_status integer not null,
  response_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index transactions_user_created_idx on public.transactions(user_id, created_at desc);

-- RLS helper: resolves the caller's relationship to a pool without recursing
-- through the split_pools/pool_members policies.
create function public.pool_access(p_pool_id uuid)
returns text
language sql stable security definer set search_path = '' as $$
  select case
    when exists (select 1 from public.split_pools sp where sp.id = p_pool_id and sp.host_user_id = auth.uid()) then 'HOST'
    when exists (select 1 from public.pool_members pm where pm.pool_id = p_pool_id and pm.user_id = auth.uid()) then 'MEMBER'
    else 'NONE'
  end;
$$;
revoke all on function public.pool_access(uuid) from public;
grant execute on function public.pool_access(uuid) to authenticated;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  transaction_id uuid references public.transactions(id) on delete set null,
  title text not null,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- Row Level Security for the new financial tables.
alter table public.wallets enable row level security;
alter table public.virtual_cards enable row level security;
alter table public.split_pools enable row level security;
alter table public.pool_members enable row level security;
alter table public.transactions enable row level security;
alter table public.notifications enable row level security;

create policy wallets_select_own on public.wallets for select to authenticated
  using ((select auth.uid()) = user_id);
create policy wallets_insert_own on public.wallets for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy wallets_update_own on public.wallets for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy virtual_cards_select_own on public.virtual_cards for select to authenticated
  using ((select auth.uid()) = user_id);
create policy virtual_cards_insert_own on public.virtual_cards for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy virtual_cards_update_own on public.virtual_cards for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy split_pools_select_host on public.split_pools for select to authenticated
  using ((select auth.uid()) = host_user_id);
create policy split_pools_select_member on public.split_pools for select to authenticated
  using (public.pool_access(id) = 'MEMBER');
create policy split_pools_insert_host on public.split_pools for insert to authenticated
  with check ((select auth.uid()) = host_user_id);
create policy split_pools_update_host on public.split_pools for update to authenticated
  using ((select auth.uid()) = host_user_id) with check ((select auth.uid()) = host_user_id);
create policy split_pools_update_member on public.split_pools for update to authenticated
  using (public.pool_access(id) = 'MEMBER')
  with check (public.pool_access(id) = 'MEMBER');

create policy pool_members_select on public.pool_members for select to authenticated
  using (
    pool_members.user_id = (select auth.uid())
    or public.pool_access(pool_members.pool_id) = 'HOST'
  );
create policy pool_members_insert_host on public.pool_members for insert to authenticated
  with check (public.pool_access(pool_members.pool_id) = 'HOST');
create policy pool_members_update_host on public.pool_members for update to authenticated
  using (public.pool_access(pool_members.pool_id) = 'HOST')
  with check (public.pool_access(pool_members.pool_id) = 'HOST');
create policy pool_members_update_self on public.pool_members for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy transactions_select_own on public.transactions for select to authenticated
  using ((select auth.uid()) = user_id);
create policy transactions_insert_own on public.transactions for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy transactions_update_own on public.transactions for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy notifications_select_own on public.notifications for select to authenticated
  using ((select auth.uid()) = user_id);
create policy notifications_update_own on public.notifications for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Explicit privileges for the new financial tables.
revoke all on public.wallets, public.virtual_cards, public.split_pools, public.pool_members,
  public.transactions, public.notifications from anon, authenticated;
grant select, insert, update, delete on public.wallets to authenticated;
grant all on public.wallets to service_role;
grant select, insert, update on public.virtual_cards to authenticated;
grant all on public.virtual_cards to service_role;
grant select, insert, update on public.split_pools to authenticated;
grant all on public.split_pools to service_role;
grant select, insert, update on public.pool_members to authenticated;
grant all on public.pool_members to service_role;
grant select, insert, update, delete on public.transactions to authenticated;
grant all on public.transactions to service_role;
grant select, insert, update on public.notifications to authenticated;
grant all on public.notifications to service_role;

commit;
