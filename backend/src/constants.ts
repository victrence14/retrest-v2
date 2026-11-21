/** The single demo identity behind the signed demo session cookie. */
export const DEMO_USER_ID = "user_ada";
/** Simulated executable quote, NGN per USD. Never call an external FX service in the auth path. */
export const EXCHANGE_RATE = 1535.25;
/** Largest amount (minor units) accepted for wallet funding and new subscriptions. */
export const MAX_FUNDING_AMOUNT = 100_000_000;
/** Largest merchant limit (minor units) a user can approve. */
export const MAX_MERCHANT_LIMIT = 100_000_000_000;
