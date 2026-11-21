import type { DatabaseSync } from "node:sqlite";
import type { Config } from "./config.ts";
import { getDashboard } from "./services/dashboard.ts";

/** Dependencies shared by every route module. */
export interface AppContext {
  config: Config;
  db: DatabaseSync;
}

export const dashboardFor = ({ db, config }: AppContext, userId: string) =>
  getDashboard(db, userId, config.demoEnabled);
