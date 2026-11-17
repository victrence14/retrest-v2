PRAGMA foreign_keys = ON;

-- All amounts use integer minor units: kobo for NGN, cents for USD.
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  ngn_balance INTEGER NOT NULL DEFAULT 0 CHECK (ngn_balance >= 0),
  usd_balance INTEGER NOT NULL DEFAULT 0 CHECK (usd_balance >= 0),
  auto_fx_enabled INTEGER NOT NULL DEFAULT 1 CHECK (auto_fx_enabled IN (0, 1)),
  fx_converted_ngn INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS virtual_cards (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
  masked_pan TEXT NOT NULL,
  expiry TEXT NOT NULL,
  card_status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (card_status IN ('ACTIVE', 'FROZEN')),
  provider_card_id TEXT NOT NULL UNIQUE
  -- PAN and CVV belong in an issuer-hosted secure reveal flow, never in our database.
);
CREATE TABLE IF NOT EXISTS merchant_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  merchant_name TEXT NOT NULL,
  merchant_descriptor TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PAUSED')),
  expected_amount INTEGER NOT NULL CHECK (expected_amount > 0),
  expected_max_amount INTEGER NOT NULL CHECK (expected_max_amount >= expected_amount),
  currency TEXT NOT NULL CHECK (currency IN ('NGN', 'USD')),
  billing_cycle TEXT NOT NULL DEFAULT 'MONTHLY' CHECK (billing_cycle IN ('MONTHLY', 'YEARLY')),
  next_billing_date TEXT NOT NULL,
  is_business_expense INTEGER NOT NULL DEFAULT 0,
  needs_review INTEGER NOT NULL DEFAULT 0,
  plan_name TEXT NOT NULL,
  UNIQUE(user_id, merchant_descriptor)
);
CREATE TABLE IF NOT EXISTS merchant_rules (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL UNIQUE REFERENCES merchant_subscriptions(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  merchant_descriptor TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'PAUSED')),
  expected_max_amount INTEGER NOT NULL CHECK (expected_max_amount > 0),
  UNIQUE(user_id, merchant_descriptor)
);
CREATE TABLE IF NOT EXISTS split_pools (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL UNIQUE REFERENCES merchant_subscriptions(id),
  host_user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  pool_balance INTEGER NOT NULL DEFAULT 0 CHECK (pool_balance >= 0),
  target_amount INTEGER NOT NULL CHECK (target_amount > 0),
  currency TEXT NOT NULL CHECK (currency IN ('NGN', 'USD')),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PAID')),
  fallback_enabled INTEGER NOT NULL DEFAULT 1,
  invite_token TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS pool_members (
  id TEXT PRIMARY KEY,
  pool_id TEXT NOT NULL REFERENCES split_pools(id),
  user_id TEXT REFERENCES users(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  share_amount INTEGER NOT NULL CHECK (share_amount > 0),
  payment_status TEXT NOT NULL CHECK (payment_status IN ('PAID', 'PENDING', 'OVERDUE')),
  auto_debit_scheduled INTEGER NOT NULL DEFAULT 0,
  UNIQUE(pool_id, email)
);
CREATE TABLE IF NOT EXISTS transaction_logs (
  id TEXT PRIMARY KEY,
  authorization_id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id),
  subscription_id TEXT REFERENCES merchant_subscriptions(id),
  merchant_name TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL CHECK (currency IN ('NGN', 'USD')),
  status TEXT NOT NULL CHECK (status IN ('APPROVED', 'DECLINED_KILL_SWITCH', 'DECLINED_PRICE_HIKE', 'DECLINED_INSUFFICIENT_FUNDS', 'DECLINED_UNKNOWN_MERCHANT', 'DECLINED_CURRENCY_MISMATCH', 'DECLINED_CARD_FROZEN')),
  decline_reason TEXT,
  receipt_url TEXT,
  fx_ngn_amount INTEGER NOT NULL DEFAULT 0,
  pool_amount INTEGER NOT NULL DEFAULT 0,
  http_status INTEGER NOT NULL,
  response_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  subscription_id TEXT REFERENCES merchant_subscriptions(id),
  transaction_id TEXT REFERENCES transaction_logs(id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transaction_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscriptions_billing ON merchant_subscriptions(user_id, next_billing_date);
