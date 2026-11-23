begin;

-- Financial values are snapshots in minor units, never floating-point values.
alter table public.subscriptions
  add column merchant_descriptor text check (char_length(merchant_descriptor) between 1 and 100),
  add column expected_max_amount bigint not null default 0,
  add column billing_cycle text not null default 'MONTHLY' check (billing_cycle in ('MONTHLY', 'YEARLY')),
  add column next_billing_date date,
  add column is_business_expense boolean not null default false,
  add column needs_review boolean not null default false;
update public.subscriptions set expected_max_amount = amount_minor;
alter table public.subscriptions
  add constraint subscriptions_amount_range check (amount_minor <= 9007199254740991),
  add constraint subscriptions_max_range check (expected_max_amount between amount_minor and 9007199254740991),
  add constraint subscriptions_id_owner unique (id, user_id);
create unique index subscriptions_descriptor_idx on public.subscriptions(user_id, merchant_descriptor);
create index subscriptions_page_idx on public.subscriptions(user_id, created_at desc, id desc);

create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  auto_fx_enabled boolean not null default true,
  phone text check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  time_zone text not null default 'Africa/Lagos' check (char_length(time_zone) between 1 and 64),
  email_notifications boolean not null default true,
  monthly_summary_email boolean not null default false,
  updated_at timestamptz not null default now()
);
create trigger user_settings_updated_at before update on public.user_settings
for each row execute function public.touch_updated_at();
insert into public.user_settings(user_id) select id from auth.users;
create function public.initialize_account_settings()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.user_settings(user_id) values (new.id);
  return new;
end;
$$;
create trigger auth_user_settings after insert on auth.users
for each row execute function public.initialize_account_settings();

create table public.revoked_account_sessions (
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  revoked_at timestamptz not null default now(),
  primary key(user_id, session_id)
);
create table public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  auth_session_id uuid not null,
  name text not null check (char_length(name) between 1 and 80),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  unique(user_id, auth_session_id)
);
create index devices_user_idx on public.devices(user_id, created_at desc, id desc);

-- RLS checks the signed JWT's session_id, including direct PostgREST requests.
create function public.is_account_session_active()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from auth.users where id = auth.uid() and email_confirmed_at is not null) and not exists (
    select 1 from public.revoked_account_sessions r
    where r.user_id = auth.uid() and r.session_id::text = auth.jwt() ->> 'session_id'
  );
$$;
create function public.require_account()
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare account_id uuid := auth.uid();
begin
  if not public.is_account_session_active() or not exists (
    select 1 from auth.users where id = account_id and email_confirmed_at is not null
  ) then raise exception 'Verified active account required' using errcode = '42501'; end if;
  return account_id;
end;
$$;
create function public.account_email()
returns text language sql stable security definer set search_path = '' as $$
  select lower(email) from auth.users where id = public.require_account();
$$;
create function public.revoke_current_session()
returns boolean language plpgsql security definer set search_path = '' as $$
declare session_value uuid := (auth.jwt() ->> 'session_id')::uuid;
begin
  if auth.uid() is null or session_value is null then
    raise exception 'Session required' using errcode = '42501';
  end if;
  insert into public.revoked_account_sessions(user_id, session_id)
  values (auth.uid(), session_value) on conflict do nothing;
  update public.devices set revoked_at = coalesce(revoked_at, now())
  where user_id = auth.uid() and auth_session_id = session_value;
  return true;
end;
$$;
create function public.register_device(p_name text, p_token_hash text, p_expires_at timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare account_id uuid := public.require_account();
  session_value uuid := (auth.jwt() ->> 'session_id')::uuid;
  device public.devices;
begin
  if session_value is null or char_length(btrim(p_name)) not between 1 and 80
    or p_expires_at <= now() or p_expires_at > now() + interval '31 days'
  then raise exception 'Invalid device' using errcode = '22023'; end if;
  -- Only a new login can restore a revoked session. Re-registration rotates the opaque token.
  insert into public.devices(user_id, auth_session_id, name, token_hash, expires_at)
  values (account_id, session_value, btrim(p_name), p_token_hash, p_expires_at)
  on conflict (user_id, auth_session_id) do update
    set name = excluded.name, token_hash = excluded.token_hash, expires_at = excluded.expires_at, last_used_at = now()
    where public.devices.revoked_at is null
  returning * into device;
  if device.id is null then raise exception 'Device revoked' using errcode = '42501'; end if;
  return to_jsonb(device) - 'token_hash' - 'auth_session_id' - 'user_id';
end;
$$;
create function public.verify_device(p_token_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare account_id uuid := public.require_account(); device public.devices;
begin
  update public.devices set last_used_at = now()
  where user_id = account_id and token_hash = p_token_hash
    and auth_session_id::text = auth.jwt() ->> 'session_id'
    and revoked_at is null and expires_at > now()
  returning * into device;
  if device.id is null then raise exception 'Device unavailable' using errcode = 'P0002'; end if;
  return to_jsonb(device) - 'token_hash' - 'auth_session_id' - 'user_id';
end;
$$;
create function public.revoke_device(p_device_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare account_id uuid := public.require_account(); device public.devices;
begin
  update public.devices set revoked_at = coalesce(revoked_at, now())
  where id = p_device_id and user_id = account_id returning * into device;
  if device.id is null then raise exception 'Device unavailable' using errcode = 'P0002'; end if;
  insert into public.revoked_account_sessions(user_id, session_id)
  values (account_id, device.auth_session_id) on conflict do nothing;
  return to_jsonb(device) - 'token_hash' - 'auth_session_id' - 'user_id';
end;
$$;

create table public.pools (
  id uuid primary key default gen_random_uuid(),
  host_user_id uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid not null unique,
  name text not null check (char_length(name) between 1 and 80),
  target_amount bigint not null check (target_amount between 1 and 9007199254740991),
  currency text not null check (currency in ('NGN', 'USD')),
  balance_minor bigint not null default 0 check (balance_minor between 0 and 9007199254740991),
  fallback_enabled boolean not null default true,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'CLOSED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(subscription_id, host_user_id) references public.subscriptions(id, user_id),
  unique(id, host_user_id)
);
create trigger pools_updated_at before update on public.pools
for each row execute function public.touch_updated_at();
create index pools_host_page_idx on public.pools(host_user_id, created_at desc, id desc);
create table public.pool_members (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  display_name text not null check (char_length(display_name) between 1 and 80),
  invited_email text not null check (invited_email = lower(invited_email) and char_length(invited_email) <= 254),
  share_amount bigint not null check (share_amount between 1 and 9007199254740991),
  payment_status text not null default 'UNPAID' check (payment_status in ('UNPAID', 'PAID')),
  accepted_at timestamptz,
  unique(pool_id, invited_email), unique(pool_id, user_id), unique(id, pool_id)
);
create index pool_members_user_idx on public.pool_members(user_id, pool_id);
create table public.pool_invites (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools(id) on delete cascade,
  member_id uuid not null unique,
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key(member_id, pool_id) references public.pool_members(id, pool_id) on delete cascade
);
create function public.can_read_pool(p_pool_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_account_session_active() and (
    exists(select 1 from public.pools where id = p_pool_id and host_user_id = auth.uid())
    or exists(select 1 from public.pool_members where pool_id = p_pool_id and user_id = auth.uid() and accepted_at is not null)
  );
$$;
create function public.create_pool(p_subscription_id uuid, p_name text, p_members jsonb, p_fallback_enabled boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare account_id uuid := public.require_account(); host_email text := public.account_email();
  subscription public.subscriptions; pool public.pools; member jsonb; amount numeric; total numeric := 0;
  emails text[] := '{}'; member_email text; member_name text;
begin
  select * into subscription from public.subscriptions
  where id = p_subscription_id and user_id = account_id for update;
  if subscription.id is null then raise exception 'Subscription unavailable' using errcode = 'P0002'; end if;
  if not subscription.active or subscription.amount_minor = 0
    or char_length(btrim(p_name)) not between 1 and 80
    or jsonb_typeof(p_members) <> 'array' or jsonb_array_length(p_members) not between 2 and 20
  then raise exception 'Invalid pool' using errcode = '22023'; end if;
  for member in select value from jsonb_array_elements(p_members) loop
    member_email := lower(btrim(member ->> 'email'));
    member_name := btrim(member ->> 'display_name');
    if member_email is null or member_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      or char_length(member_email) > 254 or member_email = any(emails)
      or member_name is null or char_length(member_name) not between 1 and 80
      or jsonb_typeof(member -> 'share_amount') <> 'number'
    then raise exception 'Invalid member' using errcode = '22023'; end if;
    amount := (member ->> 'share_amount')::numeric;
    if amount < 1 or amount > 9007199254740991 or amount <> trunc(amount)
    then raise exception 'Invalid share' using errcode = '22023'; end if;
    emails := array_append(emails, member_email); total := total + amount;
  end loop;
  if total <> subscription.amount_minor or not host_email = any(emails)
  then raise exception 'Shares must include host and equal target' using errcode = '22023'; end if;
  insert into public.pools(host_user_id, subscription_id, name, target_amount, currency, fallback_enabled)
  values (account_id, subscription.id, btrim(p_name), subscription.amount_minor, subscription.currency, p_fallback_enabled)
  returning * into pool;
  for member in select value from jsonb_array_elements(p_members) loop
    member_email := lower(btrim(member ->> 'email'));
    insert into public.pool_members(pool_id, user_id, display_name, invited_email, share_amount, accepted_at)
    values(pool.id, case when member_email = host_email then account_id end,
      btrim(member ->> 'display_name'), member_email, (member ->> 'share_amount')::bigint,
      case when member_email = host_email then now() end);
  end loop;
  return jsonb_build_object('pool', to_jsonb(pool), 'members',
    (select jsonb_agg(to_jsonb(m) order by m.id) from public.pool_members m where pool_id = pool.id));
end;
$$;
create function public.create_pool_invite(p_pool_id uuid, p_member_id uuid, p_token_hash text, p_expires_at timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare account_id uuid := public.require_account(); invitation public.pool_invites;
begin
  perform 1 from public.pools where id = p_pool_id and host_user_id = account_id and status = 'ACTIVE' for update;
  if not found then raise exception 'Pool unavailable' using errcode = 'P0002'; end if;
  if p_expires_at <= now() or p_expires_at > now() + interval '31 days'
  then raise exception 'Invalid expiry' using errcode = '22023'; end if;
  perform 1 from public.pool_members where id = p_member_id and pool_id = p_pool_id and accepted_at is null;
  if not found then raise exception 'Member unavailable' using errcode = 'P0002'; end if;
  insert into public.pool_invites(pool_id, member_id, token_hash, expires_at)
  values(p_pool_id, p_member_id, p_token_hash, p_expires_at)
  on conflict(member_id) do update set token_hash = excluded.token_hash, expires_at = excluded.expires_at,
    revoked_at = null, accepted_at = null, created_at = now()
  returning * into invitation;
  return to_jsonb(invitation) - 'token_hash';
end;
$$;
create function public.get_pool_invite(p_token_hash text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare account_id uuid := public.require_account(); invitation public.pool_invites;
  member public.pool_members; pool public.pools;
begin
  select i.* into invitation from public.pool_invites i
  join public.pool_members m on m.id = i.member_id
  where i.token_hash = p_token_hash and m.invited_email = public.account_email()
    and i.revoked_at is null and (i.expires_at > now() or i.accepted_at is not null);
  if invitation.id is null then raise exception 'Invitation unavailable' using errcode = 'P0002'; end if;
  select * into member from public.pool_members where id = invitation.member_id;
  select * into pool from public.pools where id = invitation.pool_id and status = 'ACTIVE';
  if pool.id is null then raise exception 'Pool unavailable' using errcode = 'P0002'; end if;
  return jsonb_build_object('invite', to_jsonb(invitation) - 'token_hash',
    'pool', to_jsonb(pool), 'member', to_jsonb(member));
end;
$$;
create function public.accept_pool_invite(p_token_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare account_id uuid := public.require_account(); invitation public.pool_invites; pool public.pools;
begin
  -- Pool-before-member lock order matches contribution creation and settlement.
  select p.* into pool from public.pools p join public.pool_invites i on i.pool_id = p.id
  where i.token_hash = p_token_hash for update of p;
  if pool.id is null or pool.status <> 'ACTIVE' then raise exception 'Invitation unavailable' using errcode = 'P0002'; end if;
  select * into invitation from public.pool_invites where token_hash = p_token_hash for update;
  perform 1 from public.pool_members where id = invitation.member_id and invited_email = public.account_email()
    and (user_id is null or user_id = account_id);
  if not found or invitation.revoked_at is not null or (invitation.accepted_at is null and invitation.expires_at <= now())
  then raise exception 'Invitation unavailable' using errcode = 'P0002'; end if;
  update public.pool_members set user_id = account_id, accepted_at = coalesce(accepted_at, now())
  where id = invitation.member_id;
  update public.pool_invites set accepted_at = coalesce(accepted_at, now()) where id = invitation.id;
  return public.get_pool_invite(p_token_hash);
end;
$$;
create function public.revoke_pool_invite(p_invite_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare account_id uuid := public.require_account();
begin
  update public.pool_invites i set revoked_at = coalesce(i.revoked_at, now())
  where i.id = p_invite_id and exists(select 1 from public.pools p where p.id = i.pool_id and p.host_user_id = account_id);
  if not found then raise exception 'Invitation unavailable' using errcode = 'P0002'; end if;
  return true;
end;
$$;

create table public.pool_contributions (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools(id),
  member_id uuid not null,
  user_id uuid not null references auth.users(id),
  amount_minor bigint not null check (amount_minor between 1 and 9007199254740991),
  currency text not null check (currency in ('NGN', 'USD')),
  status text not null default 'PENDING' check (status in ('PENDING', 'SETTLED', 'FAILED')),
  idempotency_key text not null check (idempotency_key ~ '^[A-Za-z0-9_-]{8,128}$'),
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  unique(user_id, idempotency_key),
  foreign key(member_id, pool_id) references public.pool_members(id, pool_id)
);
create unique index contribution_open_member_idx on public.pool_contributions(member_id) where status in ('PENDING', 'SETTLED');
create index contributions_user_idx on public.pool_contributions(user_id, created_at desc, id desc);
create table public.contribution_provider_events (
  event_id text primary key check (char_length(event_id) between 1 and 200),
  contribution_id uuid not null references public.pool_contributions(id),
  status text not null check (status in ('SETTLED', 'FAILED')),
  amount_minor bigint not null,
  currency text not null,
  created_at timestamptz not null default now()
);
create function public.initiate_pool_contribution(p_pool_id uuid, p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare account_id uuid := public.require_account(); pool public.pools;
  member public.pool_members; contribution public.pool_contributions;
begin
  select * into contribution from public.pool_contributions where user_id = account_id and idempotency_key = p_idempotency_key;
  if contribution.id is not null then
    if contribution.pool_id <> p_pool_id then raise exception 'Idempotency conflict' using errcode = '22023'; end if;
    return jsonb_build_object('contribution', to_jsonb(contribution), 'replayed', true);
  end if;
  select * into pool from public.pools where id = p_pool_id for update;
  if pool.id is null or pool.status <> 'ACTIVE' then raise exception 'Pool unavailable' using errcode = 'P0002'; end if;
  -- A simultaneous request may have completed while this request waited for the pool lock.
  select * into contribution from public.pool_contributions where user_id = account_id and idempotency_key = p_idempotency_key;
  if contribution.id is not null then
    if contribution.pool_id <> p_pool_id then raise exception 'Idempotency conflict' using errcode = '22023'; end if;
    return jsonb_build_object('contribution', to_jsonb(contribution), 'replayed', true);
  end if;
  select * into member from public.pool_members where pool_id = p_pool_id and user_id = account_id and accepted_at is not null for update;
  if member.id is null then raise exception 'Membership unavailable' using errcode = 'P0002'; end if;
  if member.payment_status = 'PAID' then raise exception 'Already paid' using errcode = 'P0001'; end if;
  if exists(select 1 from public.pool_invites where member_id = member.id and revoked_at is not null)
  then raise exception 'Invitation revoked' using errcode = 'P0002'; end if;
  insert into public.pool_contributions(pool_id, member_id, user_id, amount_minor, currency, idempotency_key)
  values(pool.id, member.id, account_id, member.share_amount, pool.currency, p_idempotency_key)
  returning * into contribution;
  return jsonb_build_object('contribution', to_jsonb(contribution), 'replayed', false);
end;
$$;
create function public.record_contribution_event(p_event_id text, p_contribution_id uuid, p_status text, p_amount_minor bigint, p_currency text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare contribution public.pool_contributions; previous public.contribution_provider_events; pool_id_value uuid;
begin
  select pool_id into pool_id_value from public.pool_contributions where id = p_contribution_id;
  if pool_id_value is null then raise exception 'Contribution unavailable' using errcode = 'P0002'; end if;
  perform 1 from public.pools where id = pool_id_value for update;
  select * into contribution from public.pool_contributions where id = p_contribution_id for update;
  select * into previous from public.contribution_provider_events where event_id = p_event_id;
  if previous.event_id is not null then
    if previous.contribution_id <> p_contribution_id or previous.status <> p_status
      or previous.amount_minor <> p_amount_minor or previous.currency <> p_currency
    then raise exception 'Event conflict' using errcode = '22023'; end if;
    return jsonb_build_object('contribution', to_jsonb(contribution), 'replayed', true);
  end if;
  if contribution.amount_minor <> p_amount_minor or contribution.currency <> p_currency
    or p_status not in ('SETTLED', 'FAILED')
  then raise exception 'Settlement mismatch' using errcode = '22023'; end if;
  if contribution.status <> 'PENDING' and contribution.status <> p_status
  then raise exception 'Invalid settlement transition' using errcode = 'P0001'; end if;
  insert into public.contribution_provider_events(event_id, contribution_id, status, amount_minor, currency)
  values(p_event_id, p_contribution_id, p_status, p_amount_minor, p_currency);
  if contribution.status = 'PENDING' then
    update public.pool_contributions set status = p_status, settled_at = case when p_status = 'SETTLED' then now() end
    where id = p_contribution_id returning * into contribution;
    if p_status = 'SETTLED' then
      update public.pool_members set payment_status = 'PAID' where id = contribution.member_id;
      update public.pools set balance_minor = balance_minor + contribution.amount_minor where id = contribution.pool_id;
    end if;
  end if;
  return jsonb_build_object('contribution', to_jsonb(contribution), 'replayed', false);
end;
$$;

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  subscription_id uuid,
  provider_transaction_id text not null unique check (char_length(provider_transaction_id) between 1 and 200),
  merchant_name text not null check (char_length(merchant_name) between 1 and 100),
  amount_minor bigint not null check (amount_minor between 1 and 9007199254740991),
  currency text not null check (currency in ('NGN', 'USD')),
  status text not null check (status in ('PENDING', 'SETTLED', 'DECLINED', 'REVERSED')),
  is_business_expense boolean not null,
  fx_ngn_amount bigint not null default 0 check (fx_ngn_amount between 0 and 9007199254740991),
  pool_amount bigint not null default 0 check (pool_amount between 0 and amount_minor),
  decline_reason text check (char_length(decline_reason) <= 250),
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  updated_at timestamptz not null default now(),
  foreign key(subscription_id, user_id) references public.subscriptions(id, user_id),
  check (status not in ('SETTLED', 'REVERSED') or settled_at is not null)
);
create trigger transactions_updated_at before update on public.transactions
for each row execute function public.touch_updated_at();
create index transactions_page_idx on public.transactions(user_id, created_at desc, id desc);
create index transactions_business_idx on public.transactions(user_id, is_business_expense, status, created_at desc, id desc);
create table public.payment_provider_events (
  event_id text primary key check (char_length(event_id) between 1 and 200),
  transaction_id uuid not null references public.transactions(id),
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create function public.record_payment_event(p_event_id text, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare payment public.transactions; previous public.payment_provider_events; next_status text := p_payload ->> 'status';
begin
  -- Serialize only this provider transaction; unrelated accounts can settle concurrently.
  perform pg_advisory_xact_lock(hashtextextended(p_payload ->> 'provider_transaction_id', 0));
  select * into previous from public.payment_provider_events where event_id = p_event_id;
  if previous.event_id is not null then
    if previous.payload <> p_payload then raise exception 'Event conflict' using errcode = '22023'; end if;
    select * into payment from public.transactions where id = previous.transaction_id;
    return jsonb_build_object('transaction', to_jsonb(payment), 'replayed', true);
  end if;
  select * into payment from public.transactions where provider_transaction_id = p_payload ->> 'provider_transaction_id' for update;
  if payment.id is null then
    if next_status = 'REVERSED' then raise exception 'Cannot reverse an unknown payment' using errcode = 'P0001'; end if;
    insert into public.transactions(user_id, subscription_id, provider_transaction_id, merchant_name,
      amount_minor, currency, status, is_business_expense, fx_ngn_amount, pool_amount, decline_reason, created_at, settled_at)
    values((p_payload ->> 'user_id')::uuid, (p_payload ->> 'subscription_id')::uuid,
      p_payload ->> 'provider_transaction_id', p_payload ->> 'merchant_name', (p_payload ->> 'amount_minor')::bigint,
      p_payload ->> 'currency', next_status, (p_payload ->> 'is_business_expense')::boolean,
      coalesce((p_payload ->> 'fx_ngn_amount')::bigint, 0), coalesce((p_payload ->> 'pool_amount')::bigint, 0),
      p_payload ->> 'decline_reason', coalesce((p_payload ->> 'created_at')::timestamptz, now()),
      case when next_status = 'SETTLED' then now() end)
    returning * into payment;
  else
    if payment.user_id <> (p_payload ->> 'user_id')::uuid
      or payment.subscription_id is distinct from (p_payload ->> 'subscription_id')::uuid
      or payment.merchant_name <> p_payload ->> 'merchant_name'
      or payment.amount_minor <> (p_payload ->> 'amount_minor')::bigint or payment.currency <> p_payload ->> 'currency'
      or payment.is_business_expense <> (p_payload ->> 'is_business_expense')::boolean
      or payment.fx_ngn_amount <> coalesce((p_payload ->> 'fx_ngn_amount')::bigint, 0)
      or payment.pool_amount <> coalesce((p_payload ->> 'pool_amount')::bigint, 0)
    then raise exception 'Immutable payment fields changed' using errcode = '22023'; end if;
    if payment.status <> next_status and not (
      (payment.status = 'PENDING' and next_status in ('SETTLED', 'DECLINED'))
      or (payment.status = 'SETTLED' and next_status = 'REVERSED'))
    then raise exception 'Invalid payment transition' using errcode = 'P0001'; end if;
    update public.transactions set status = next_status, decline_reason = p_payload ->> 'decline_reason',
      settled_at = case when next_status = 'SETTLED' then coalesce(settled_at, now()) else settled_at end
    where id = payment.id returning * into payment;
  end if;
  insert into public.payment_provider_events(event_id, transaction_id, payload) values(p_event_id, payment.id, p_payload);
  return jsonb_build_object('transaction', to_jsonb(payment), 'replayed', false);
end;
$$;
create function public.transaction_summary(p_from timestamptz, p_to timestamptz, p_business boolean default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare account_id uuid := public.require_account(); totals jsonb;
begin
  if p_from is null or p_to is null or p_from >= p_to then raise exception 'Invalid period' using errcode = '22023'; end if;
  select coalesce(jsonb_agg(to_jsonb(summary) order by currency), '[]'::jsonb) into totals from (
    select currency,
      count(*) filter(where status = 'SETTLED') as settled_count,
      count(*) filter(where status = 'PENDING') as pending_count,
      count(*) filter(where status = 'DECLINED') as declined_count,
      count(*) filter(where status = 'REVERSED') as reversed_count,
      coalesce(sum(amount_minor) filter(where status = 'SETTLED'), 0)::text as settled_amount_minor,
      coalesce(sum(fx_ngn_amount) filter(where status = 'SETTLED'), 0)::text as fx_ngn_amount_minor,
      coalesce(sum(pool_amount) filter(where status = 'SETTLED'), 0)::text as pool_amount_minor
    from public.transactions where user_id = account_id and created_at >= p_from and created_at < p_to
      and (p_business is null or is_business_expense = p_business)
    group by currency
  ) summary;
  return totals;
end;
$$;

create table public.account_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  message text not null check (char_length(message) between 1 and 1000),
  resource_type text check (resource_type in ('subscription', 'transaction', 'pool', 'support', 'summary')),
  resource_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_page_idx on public.account_notifications(user_id, created_at desc, id desc);
create index notifications_unread_idx on public.account_notifications(user_id) where read_at is null;
create function public.mark_notifications_read(p_ids uuid[] default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare account_id uuid := public.require_account(); changed integer;
begin
  if cardinality(p_ids) > 100 then raise exception 'Too many notifications' using errcode = '22023'; end if;
  update public.account_notifications set read_at = now()
  where user_id = account_id and read_at is null and (p_ids is null or id = any(p_ids));
  get diagnostics changed = row_count;
  return changed;
end;
$$;

-- Default-deny all new tables. Internal state is writable only through audited functions.
alter table public.user_settings enable row level security;
alter table public.devices enable row level security;
alter table public.revoked_account_sessions enable row level security;
alter table public.pools enable row level security;
alter table public.pool_members enable row level security;
alter table public.pool_invites enable row level security;
alter table public.pool_contributions enable row level security;
alter table public.contribution_provider_events enable row level security;
alter table public.transactions enable row level security;
alter table public.payment_provider_events enable row level security;
alter table public.account_notifications enable row level security;
revoke all on public.user_settings, public.devices, public.revoked_account_sessions, public.pools,
  public.pool_members, public.pool_invites, public.pool_contributions, public.contribution_provider_events,
  public.transactions, public.payment_provider_events, public.account_notifications from public, anon, authenticated;
grant all on public.user_settings, public.devices, public.revoked_account_sessions, public.pools,
  public.pool_members, public.pool_invites, public.pool_contributions, public.contribution_provider_events,
  public.transactions, public.payment_provider_events, public.account_notifications to service_role;
grant select on public.user_settings, public.pools, public.pool_members, public.pool_contributions,
  public.transactions, public.account_notifications to authenticated;
grant select(id, user_id, name, created_at, last_used_at, expires_at, revoked_at) on public.devices to authenticated;
grant update(auto_fx_enabled, phone, theme, time_zone, email_notifications, monthly_summary_email)
  on public.user_settings to authenticated;
grant update(name, fallback_enabled, status) on public.pools to authenticated;
create policy settings_read on public.user_settings for select to authenticated
  using (user_id = (select auth.uid()) and (select public.is_account_session_active()));
create policy settings_update on public.user_settings for update to authenticated
  using (user_id = (select auth.uid()) and (select public.is_account_session_active()))
  with check (user_id = (select auth.uid()) and (select public.is_account_session_active()));
create policy devices_read on public.devices for select to authenticated
  using (user_id = (select auth.uid()) and (select public.is_account_session_active()));
create policy pools_read on public.pools for select to authenticated using (public.can_read_pool(id));
create policy pools_update on public.pools for update to authenticated
  using (host_user_id = (select auth.uid()) and (select public.is_account_session_active()))
  with check (host_user_id = (select auth.uid()) and (select public.is_account_session_active()));
create policy members_read on public.pool_members for select to authenticated using (public.can_read_pool(pool_id));
create policy contributions_read on public.pool_contributions for select to authenticated
  using (public.can_read_pool(pool_id));
create policy transactions_read on public.transactions for select to authenticated
  using (user_id = (select auth.uid()) and (select public.is_account_session_active()));
create policy notifications_read on public.account_notifications for select to authenticated
  using (user_id = (select auth.uid()) and (select public.is_account_session_active()));

-- Restrict legacy tables too; changing a record's owner or financial review state is forbidden.
revoke all on public.subscriptions from authenticated;
grant select on public.subscriptions to authenticated;
grant insert(user_id, name, merchant_descriptor, category_slug, amount_minor, expected_max_amount,
  currency, active, billing_cycle, next_billing_date, is_business_expense) on public.subscriptions to authenticated;
grant update(name, merchant_descriptor, category_slug, amount_minor, expected_max_amount,
  currency, active, billing_cycle, next_billing_date, is_business_expense) on public.subscriptions to authenticated;
drop policy "Read own profile" on public.profiles;
drop policy "Update own profile" on public.profiles;
drop policy "Read own subscriptions" on public.subscriptions;
drop policy "Create own subscriptions" on public.subscriptions;
drop policy "Update own subscriptions" on public.subscriptions;
drop policy "Delete own subscriptions" on public.subscriptions;
create policy profiles_read on public.profiles for select to authenticated
  using (id = (select auth.uid()) and (select public.is_account_session_active()));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid()) and (select public.is_account_session_active()))
  with check (id = (select auth.uid()) and (select public.is_account_session_active()));
create policy subscriptions_read on public.subscriptions for select to authenticated
  using (user_id = (select auth.uid()) and (select public.is_account_session_active()));
create policy subscriptions_insert on public.subscriptions for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.is_account_session_active()));
create policy subscriptions_update on public.subscriptions for update to authenticated
  using (user_id = (select auth.uid()) and (select public.is_account_session_active()))
  with check (user_id = (select auth.uid()) and (select public.is_account_session_active()));

revoke all on function public.initialize_account_settings(), public.require_account(), public.account_email(),
  public.is_account_session_active(), public.revoke_current_session(), public.register_device(text,text,timestamptz),
  public.verify_device(text), public.revoke_device(uuid), public.can_read_pool(uuid),
  public.create_pool(uuid,text,jsonb,boolean), public.create_pool_invite(uuid,uuid,text,timestamptz),
  public.get_pool_invite(text), public.accept_pool_invite(text), public.revoke_pool_invite(uuid),
  public.initiate_pool_contribution(uuid,text), public.record_contribution_event(text,uuid,text,bigint,text),
  public.record_payment_event(text,jsonb), public.transaction_summary(timestamptz,timestamptz,boolean),
  public.mark_notifications_read(uuid[]) from public, anon, authenticated;
grant execute on function public.is_account_session_active(), public.revoke_current_session(),
  public.register_device(text,text,timestamptz), public.verify_device(text), public.revoke_device(uuid),
  public.can_read_pool(uuid), public.create_pool(uuid,text,jsonb,boolean),
  public.create_pool_invite(uuid,uuid,text,timestamptz), public.get_pool_invite(text),
  public.accept_pool_invite(text), public.revoke_pool_invite(uuid), public.initiate_pool_contribution(uuid,text),
  public.transaction_summary(timestamptz,timestamptz,boolean), public.mark_notifications_read(uuid[]) to authenticated;
grant execute on function public.record_contribution_event(text,uuid,text,bigint,text),
  public.record_payment_event(text,jsonb) to service_role;

commit;
