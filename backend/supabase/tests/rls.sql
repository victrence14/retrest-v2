-- Run against a disposable local database after migration/seed. Rolls back fixtures.
begin;
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'rls-one@example.test', '{"display_name":"One"}'),
  ('22222222-2222-4222-8222-222222222222', 'rls-two@example.test', '{"display_name":"Two"}');
insert into public.subscriptions (user_id, name) values
  ('11111111-1111-4111-8111-111111111111', 'One private bill'),
  ('22222222-2222-4222-8222-222222222222', 'Two private bill');

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
do $$
declare changed integer;
begin
  if (select count(*) from public.profiles) <> 1 then raise exception 'Profile isolation failed'; end if;
  if (select count(*) from public.subscriptions) <> 1 then raise exception 'Subscription isolation failed'; end if;
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
