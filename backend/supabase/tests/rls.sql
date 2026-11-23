-- Run against a disposable local database after migration/seed. Rolls back fixtures.
begin;
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'rls-one@example.test', now(), '{"display_name":"One"}'),
  ('22222222-2222-4222-8222-222222222222', 'rls-two@example.test', now(), '{"display_name":"Two"}'),
  ('33333333-3333-4333-8333-333333333333', 'rls-unconfirmed@example.test', null, '{"display_name":"Unconfirmed"}');
insert into public.subscriptions (user_id, name) values
  ('11111111-1111-4111-8111-111111111111', 'One private bill'),
  ('22222222-2222-4222-8222-222222222222', 'Two private bill');
insert into public.transactions (user_id, provider_transaction_id, merchant_name, amount_minor, currency, status, is_business_expense, settled_at) values
  ('11111111-1111-4111-8111-111111111111', 'rls-payment-one', 'One merchant', 100, 'NGN', 'SETTLED', true, now()),
  ('22222222-2222-4222-8222-222222222222', 'rls-payment-two', 'Two merchant', 200, 'NGN', 'SETTLED', true, now());
insert into public.account_notifications (user_id, title, message) values
  ('11111111-1111-4111-8111-111111111111', 'One message', 'One private notification'),
  ('22222222-2222-4222-8222-222222222222', 'Two message', 'Two private notification');

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","session_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}', true);
do $$
declare changed integer;
begin
  if (select count(*) from public.profiles) <> 1 then raise exception 'Profile isolation failed'; end if;
  if (select count(*) from public.subscriptions) <> 1 then raise exception 'Subscription isolation failed'; end if;
  if (select count(*) from public.user_settings) <> 1 then raise exception 'Settings isolation failed'; end if;
  if (select count(*) from public.transactions) <> 1 then raise exception 'Ledger isolation failed'; end if;
  if (select count(*) from public.account_notifications) <> 1 then raise exception 'Notification isolation failed'; end if;
  update public.profiles set display_name = 'Own edit' where id = '11111111-1111-4111-8111-111111111111';
  get diagnostics changed = row_count;
  if changed <> 1 then raise exception 'Own profile update failed'; end if;
  update public.profiles set display_name = 'Forbidden' where id = '22222222-2222-4222-8222-222222222222';
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Cross-user profile update succeeded'; end if;
  begin
    insert into public.subscriptions (user_id, name) values ('22222222-2222-4222-8222-222222222222', 'Forbidden');
    raise exception 'Cross-user subscription insert succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.subscriptions set user_id = '22222222-2222-4222-8222-222222222222';
    raise exception 'Subscription ownership transfer succeeded';
  exception when insufficient_privilege then null;
  end;
  update public.user_settings set theme = 'light' where user_id = '11111111-1111-4111-8111-111111111111';
  get diagnostics changed = row_count;
  if changed <> 1 then raise exception 'Own settings update failed'; end if;
  update public.user_settings set theme = 'dark' where user_id = '22222222-2222-4222-8222-222222222222';
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Cross-user settings update succeeded'; end if;
  begin
    update public.transactions set status = 'SETTLED';
    raise exception 'Untrusted ledger update succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.support_agents (user_id) values ('11111111-1111-4111-8111-111111111111');
    raise exception 'Customer assigned staff membership';
  exception when insufficient_privilege then null;
  end;
  if public.mark_notifications_read() <> 1 then raise exception 'Own notification read failed'; end if;
  if public.mark_notifications_read() <> 0 then raise exception 'Notification read was not idempotent'; end if;
  perform public.register_device('SQL fixture', repeat('a', 64), now() + interval '1 day');
  if (select count(id) from public.devices) <> 1 then raise exception 'Device registration failed'; end if;
  perform public.revoke_current_session();
  if public.is_account_session_active() then raise exception 'Session revocation failed'; end if;
  if exists(select 1 from public.user_settings) or exists(select 1 from public.transactions) then
    raise exception 'Revoked session retained direct RLS access';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
select set_config('request.jwt.claims', '{"sub":"33333333-3333-4333-8333-333333333333","session_id":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"}', true);
do $$
begin
  if public.is_account_session_active() then raise exception 'Unconfirmed account gained access'; end if;
  if exists(select 1 from public.profiles) or exists(select 1 from public.user_settings) then
    raise exception 'Unconfirmed account retained direct RLS access';
  end if;
end;
$$;

set local role anon;
do $$
begin
  if (select count(*) from public.subscription_categories) < 1 then raise exception 'Public seed inaccessible'; end if;
  begin
    perform 1 from public.profiles;
    raise exception 'Anonymous profile access succeeded';
  exception when insufficient_privilege then null;
  end;
end;
$$;
rollback;
