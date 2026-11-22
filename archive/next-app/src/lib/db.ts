import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type {
  Dashboard,
  User,
  Card,
  Subscription,
  Pool,
  PoolMember,
  Transaction,
  Notification,
} from "./types.ts";

export const DEMO_USER_ID = "user_ada";
// Simulated executable quote, NGN per USD. Never call an external FX service in the auth path.
export const EXCHANGE_RATE = 1535.25;
export const demoEnabled = () => process.env.RETREST_DEMO_ENABLED !== "false";
const globalDb = globalThis as typeof globalThis & { retrestDb?: DatabaseSync };

export function initializeDatabase(db: DatabaseSync) {
  db.exec(readFileSync(join(process.cwd(), "db/schema.sql"), "utf8"));
  db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 200;");
  return db;
}

export function getDb(): DatabaseSync {
  if (!globalDb.retrestDb) {
    mkdirSync(join(process.cwd(), "data"), { recursive: true });
    const db = initializeDatabase(
      new DatabaseSync(join(process.cwd(), "data/retrest.sqlite")),
    );
    seedDatabase(db);
    globalDb.retrestDb = db;
  }
  return globalDb.retrestDb;
}

const futureDate = (days: number) =>
  new Date(Date.now() + days * 86400000).toISOString();

export function seedDatabase(db: DatabaseSync) {
  if (db.prepare("SELECT id FROM users WHERE id = ?").get(DEMO_USER_ID)) return;
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(
      "INSERT INTO users (id, name, email, ngn_balance, usd_balance) VALUES (?, ?, ?, ?, ?)",
    ).run(DEMO_USER_ID, "Ada Okafor", "ada@retrest.app", 18450000, 1250);
    db.prepare(
      "INSERT INTO virtual_cards (id,user_id,masked_pan,expiry,provider_card_id) VALUES (?,?,?,?,?)",
    ).run(
      "card_ada",
      DEMO_USER_ID,
      "•••• •••• •••• 4289",
      "08/29",
      "retrest_demo_master",
    );
    const seeds = [
      [
        "netflix",
        "Netflix",
        "NETFLIX",
        "Entertainment",
        "ACTIVE",
        700000,
        "NGN",
        2,
        0,
        0,
        "Premium · Family plan",
      ],
      [
        "spotify",
        "Spotify",
        "SPOTIFY",
        "Music",
        "ACTIVE",
        130000,
        "NGN",
        3,
        0,
        0,
        "Premium Individual",
      ],
      [
        "chatgpt",
        "ChatGPT",
        "OPENAI",
        "Productivity",
        "ACTIVE",
        2000,
        "USD",
        5,
        1,
        0,
        "Plus subscription",
      ],
      [
        "aws",
        "Amazon Web Services",
        "AWS",
        "Cloud hosting",
        "ACTIVE",
        1500,
        "USD",
        12,
        1,
        0,
        "Cloud infrastructure",
      ],
      [
        "canva",
        "Canva",
        "CANVA",
        "Design",
        "ACTIVE",
        450000,
        "NGN",
        6,
        1,
        0,
        "Pro · Team plan",
      ],
      [
        "youtube",
        "YouTube",
        "YOUTUBE",
        "Entertainment",
        "PAUSED",
        190000,
        "NGN",
        9,
        0,
        1,
        "Premium subscription",
      ],
    ];
    const sub = db.prepare(
      "INSERT INTO merchant_subscriptions (id,user_id,merchant_name,merchant_descriptor,category,status,expected_amount,expected_max_amount,currency,next_billing_date,is_business_expense,needs_review,plan_name) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
    );
    const rule = db.prepare(
      "INSERT INTO merchant_rules (id,subscription_id,user_id,merchant_descriptor,status,expected_max_amount) VALUES (?,?,?,?,?,?)",
    );
    for (const [
      id,
      name,
      descriptor,
      category,
      status,
      amount,
      currency,
      days,
      business,
      review,
      plan,
    ] of seeds) {
      sub.run(
        id,
        DEMO_USER_ID,
        name,
        descriptor,
        category,
        status,
        amount,
        amount,
        currency,
        futureDate(Number(days)),
        business,
        review,
        plan,
      );
      rule.run(`rule_${id}`, id, DEMO_USER_ID, descriptor, status, amount);
    }
    const pool = db.prepare(
      "INSERT INTO split_pools (id,subscription_id,host_user_id,name,pool_balance,target_amount,currency,invite_token) VALUES (?,?,?,?,?,?,?,?)",
    );
    pool.run(
      "pool_netflix",
      "netflix",
      DEMO_USER_ID,
      "The watch party",
      500000,
      700000,
      "NGN",
      "watch-party-" + randomUUID(),
    );
    pool.run(
      "pool_canva",
      "canva",
      DEMO_USER_ID,
      "The creative crew",
      450000,
      450000,
      "NGN",
      "creative-crew-" + randomUUID(),
    );
    const member = db.prepare(
      "INSERT INTO pool_members (id,pool_id,user_id,name,email,share_amount,payment_status,auto_debit_scheduled) VALUES (?,?,?,?,?,?,?,?)",
    );
    member.run(
      "member_ada_netflix",
      "pool_netflix",
      DEMO_USER_ID,
      "Ada Okafor",
      "ada@retrest.app",
      250000,
      "PAID",
      0,
    );
    member.run(
      "member_tobi",
      "pool_netflix",
      null,
      "Tobi Adebayo",
      "tobi@example.com",
      250000,
      "PAID",
      0,
    );
    member.run(
      "member_chioma",
      "pool_netflix",
      null,
      "Chioma Eze",
      "chioma@example.com",
      200000,
      "PENDING",
      1,
    );
    member.run(
      "member_ada_canva",
      "pool_canva",
      DEMO_USER_ID,
      "Ada Okafor",
      "ada@retrest.app",
      150000,
      "PAID",
      0,
    );
    member.run(
      "member_dami",
      "pool_canva",
      null,
      "Dami Adeyemi",
      "dami@example.com",
      150000,
      "PAID",
      0,
    );
    member.run(
      "member_emeka",
      "pool_canva",
      null,
      "Emeka Obi",
      "emeka@example.com",
      150000,
      "PAID",
      0,
    );
    const logs = db.prepare(
      "INSERT INTO transaction_logs (id,authorization_id,user_id,subscription_id,merchant_name,amount,currency,status,decline_reason,receipt_url,http_status,response_json,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
    );
    const history = [
      [
        "seed_spotify",
        "spotify",
        "Spotify",
        130000,
        "NGN",
        "APPROVED",
        null,
        0.02,
      ],
      [
        "seed_hike",
        "netflix",
        "Netflix",
        840000,
        "NGN",
        "DECLINED_PRICE_HIKE",
        "Price Hike Blocked",
        0.06,
      ],
      [
        "seed_youtube",
        "youtube",
        "YouTube",
        190000,
        "NGN",
        "DECLINED_KILL_SWITCH",
        "Blocked by Kill Switch",
        0.12,
      ],
      [
        "seed_aws",
        "aws",
        "Amazon Web Services",
        1500,
        "USD",
        "APPROVED",
        null,
        2,
      ],
      ["seed_canva", "canva", "Canva", 450000, "NGN", "APPROVED", null, 4],
      ["seed_chatgpt", "chatgpt", "ChatGPT", 2000, "USD", "APPROVED", null, 6],
    ];
    for (const [
      id,
      subscription,
      name,
      amount,
      currency,
      status,
      reason,
      days,
    ] of history) {
      logs.run(
        id,
        id,
        DEMO_USER_ID,
        subscription,
        name,
        amount,
        currency,
        status,
        reason,
        status === "APPROVED" ? `/api/receipts/${id}` : null,
        status === "APPROVED" ? 200 : 403,
        "{}",
        futureDate(-Number(days)),
      );
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function dashboard(userId = DEMO_USER_ID): Dashboard {
  const db = getDb();
  const pools = db
    .prepare(
      "SELECT p.*,s.merchant_name,s.next_billing_date FROM split_pools p JOIN merchant_subscriptions s ON s.id=p.subscription_id WHERE host_user_id=?",
    )
    .all(userId) as unknown as Pool[];
  for (const pool of pools)
    pool.members = db
      .prepare(
        "SELECT * FROM pool_members WHERE pool_id=? ORDER BY user_id IS NULL, name",
      )
      .all(pool.id) as unknown as PoolMember[];
  const state: Dashboard = {
    user: db
      .prepare("SELECT * FROM users WHERE id=?")
      .get(userId) as unknown as User,
    card: db
      .prepare("SELECT * FROM virtual_cards WHERE user_id=?")
      .get(userId) as unknown as Card,
    subscriptions: db
      .prepare(
        "SELECT * FROM merchant_subscriptions WHERE user_id=? ORDER BY next_billing_date",
      )
      .all(userId) as unknown as Subscription[],
    pools,
    transactions: db
      .prepare(
        "SELECT t.*,s.is_business_expense FROM transaction_logs t LEFT JOIN merchant_subscriptions s ON s.id=t.subscription_id WHERE t.user_id=? ORDER BY t.created_at DESC LIMIT 100",
      )
      .all(userId) as unknown as Transaction[],
    notifications: db
      .prepare(
        "SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 30",
      )
      .all(userId) as unknown as Notification[],
    exchange_rate: EXCHANGE_RATE,
    demo_enabled: demoEnabled(),
  };
  // node:sqlite rows have null prototypes; React's server boundary requires plain objects.
  return JSON.parse(JSON.stringify(state)) as Dashboard;
}
