-- Product-domain RLS: pools, members, contributions, devices, summaries and invites.
-- Run against a disposable local database after all migrations. Rolls back fixtures.
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'host@example.test', '{"display_name":"Host"}'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'member@example.test', '{"display_name":"Member"}'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'outsider@example.test', '{"display_name":"Outsider"}'),
  ('ffffffff-ffff-4fff-8fff-ffffffffffff', 'forged@example.test', '{"display_name":"Forged"}');

insert into public.subscriptions (id, user_id, name, merchant_name, merchant_descriptor, amount_minor, currency)
values (
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Family music', 'Spotify', 'SPOTIFY', 500000, 'NGN'
);

insert into public.split_pools (id, subscription_id, host_user_id, name, target_amount, currency, invite_token, invite_expires_at)
values (
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Family music pool', 500000, 'NGN', 'invite-token-host', now() + interval '7 days'
);

-- The invited member starts unbound; acceptance binds the verified identity.
insert into public.pool_members (pool_id, name, email, share_amount) values
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'Member', 'member@example.test', 250000),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'Host', 'host@example.test', 250000);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
do $$
begin
  if (select count(*) from public.split_pools) <> 1 then raise exception 'Host pool visibility failed'; end if;
  if (select count(*) from public.pool_members) <> 2 then raise exception 'Host member visibility failed'; end if;
  insert into public.pool_contributions (pool_id, user_id, amount_minor, currency, reference, status)
  values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 100000, 'NGN', 'host-ref-1', 'SETTLED');
  begin
    insert into public.pool_contributions (pool_id, user_id, amount_minor, currency, reference, status)
    values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 100000, 'NGN', 'host-ref-1', 'SETTLED');
    raise exception 'Duplicate contribution accepted';
  exception when unique_violation then null;
  end;
  insert into public.pool_members (pool_id, name, email, share_amount)
  values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'Guest', 'guest@example.test', 10000);
end;
$$;

-- Public token lookup is allowed; anonymous acceptance is not.
set local role anon;
do $$
declare invited record;
begin
  select * into invited from public.pool_invite('invite-token-host');
  if invited.pool_id is null then raise exception 'Public invite lookup failed'; end if;
  if invited.name <> 'Family music pool' then raise exception 'Public invite payload incorrect'; end if;
  begin
    perform 1 from public.accept_pool_invite('invite-token-host');
    raise exception 'Anonymous invite acceptance succeeded';
  exception when insufficient_privilege then null;
  end;
end;
$$;

-- The invited identity accepts, then manages only its own membership row.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);
do $$
declare changed integer;
begin
  select count(*) into changed from public.accept_pool_invite('invite-token-host');
  if changed <> 1 then raise exception 'Invite acceptance failed'; end if;
  if (select user_id from public.pool_members where email = 'member@example.test')
     <> 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' then
    raise exception 'Invite did not bind the verified identity';
  end if;
  if (select count(*) from public.split_pools) <> 1 then raise exception 'Member pool visibility failed'; end if;
  if (select count(*) from public.pool_contributions) <> 0 then raise exception 'Member saw the host contribution'; end if;
  update public.pool_members set payment_status = 'PAID' where email = 'member@example.test';
  get diagnostics changed = row_count;
  if changed <> 1 then raise exception 'Member own row update failed'; end if;
  update public.pool_members set payment_status = 'PAID' where email = 'host@example.test';
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Member changed another row'; end if;
  begin
    insert into public.pool_members (pool_id, name, email, share_amount)
    values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'Sneaky', 'sneaky@example.test', 1);
    raise exception 'Non-host added a pool member';
  exception when insufficient_privilege then null;
  end;
end;
$$;

-- A different verified identity cannot claim someone else's invitation.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'ffffffff-ffff-4fff-8fff-ffffffffffff', true);
do $$
begin
  begin
    perform 1 from public.accept_pool_invite('invite-token-host');
    raise exception 'Forged invite identity was accepted';
  exception when raise_exception then
    if sqlerrm not like '%invite_email_mismatch%' then raise; end if;
  end;
end;
$$;

-- An unrelated authenticated user sees no pool data and cannot contribute.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', true);
do $$
begin
  if (select count(*) from public.split_pools) <> 0 then raise exception 'Outsider saw a pool'; end if;
  if (select count(*) from public.pool_members) <> 0 then raise exception 'Outsider saw pool members'; end if;
  begin
    insert into public.pool_contributions (pool_id, user_id, amount_minor, currency, reference, status)
    values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 1000, 'NGN', 'outsider-ref', 'SETTLED');
    raise exception 'Outsider contributed to a pool';
  exception when insufficient_privilege then null;
  end;
  insert into public.user_devices (user_id, device_name)
  values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Outsider phone');
  if (select count(*) from public.user_devices) <> 1 then raise exception 'Device visibility failed'; end if;
  insert into public.spend_summaries (user_id, month, totals)
  values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', '2026-11', '{}'::jsonb);
  if (select count(*) from public.spend_summaries) <> 1 then raise exception 'Summary visibility failed'; end if;
end;
$$;

-- Devices and summaries stay scoped to their owner.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
do $$
begin
  if (select count(*) from public.user_devices) <> 0 then raise exception 'Host saw another device'; end if;
  if (select count(*) from public.spend_summaries) <> 0 then raise exception 'Host saw another summary'; end if;
end;
$$;

rollback;
