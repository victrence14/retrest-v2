import type { Dashboard, DemoResult, DemoScenario } from "@retrest/shared";
import { requestJson } from "@/lib/api/client";

/** Sends a simulated issuer charge through the backend's authorization engine. */
export const runScenario = (scenario: DemoScenario) =>
  requestJson<DemoResult>("/api/demo", { method: "POST", body: { scenario } });

/** Restores the demo account's seeded balances, merchants, and pools. */
export const resetDemo = () => requestJson<Dashboard>("/api/demo/reset", { method: "POST", body: {} });
