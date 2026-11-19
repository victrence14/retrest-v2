begin;

-- Identity belongs to Supabase Auth. Application data references auth.users.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subscription_categories (
  slug text primary key,
  label text not null
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  category_slug text references public.subscription_categories(slug),
  amount_minor bigint not null default 0 check (amount_minor >= 0),
  currency text not null default 'NGN' check (currency in ('NGN', 'USD')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subscriptions_user_id_idx on public.subscriptions(user_id);

create function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger profiles_updated_at before update on public.profiles
for each row execute function public.touch_updated_at();
create trigger subscriptions_updated_at before update on public.subscriptions
for each row execute function public.touch_updated_at();

create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, display_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 80));
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- Also create profiles for accounts that existed before this migration.
insert into public.profiles (id, display_name)
select id, left(coalesce(raw_user_meta_data ->> 'display_name', ''), 80)
from auth.users on conflict (id) do nothing;

alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.subscription_categories enable row level security;

-- Explicit privileges avoid relying on project-specific default grants.
revoke all on public.profiles, public.subscriptions, public.subscription_categories from anon, authenticated;
grant select on public.profiles to authenticated;
grant update(display_name) on public.profiles to authenticated;
grant select, insert, update, delete on public.subscriptions to authenticated;
grant select on public.subscription_categories to anon, authenticated;
grant all on public.profiles, public.subscriptions, public.subscription_categories to service_role;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.touch_updated_at() from public, anon, authenticated;

create policy "Read own profile" on public.profiles for select to authenticated
using ((select auth.uid()) = id);
create policy "Update own profile" on public.profiles for update to authenticated
using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "Read own subscriptions" on public.subscriptions for select to authenticated
using ((select auth.uid()) = user_id);
create policy "Create own subscriptions" on public.subscriptions for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy "Update own subscriptions" on public.subscriptions for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Delete own subscriptions" on public.subscriptions for delete to authenticated
using ((select auth.uid()) = user_id);
create policy "Read categories" on public.subscription_categories for select to anon, authenticated
using (true);

commit;
