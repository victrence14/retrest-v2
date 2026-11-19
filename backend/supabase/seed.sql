-- Idempotent public reference data. Accounts are created via Supabase Auth.
-- No hardcoded users, passwords, tokens, or privileged credentials.
insert into public.subscription_categories (slug, label) values
  ('entertainment', 'Entertainment'), ('music', 'Music'),
  ('productivity', 'Productivity'), ('hosting', 'Cloud hosting')
on conflict (slug) do update set label = excluded.label;
