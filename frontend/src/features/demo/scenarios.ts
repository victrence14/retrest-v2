import { CheckCircle2, Globe, ShieldOff, TriangleAlert, Users, type LucideIcon } from "lucide-react";
import type { DemoScenario } from "@retrest/shared";

export interface ScenarioCard {
  id: DemoScenario;
  icon: LucideIcon;
  title: string;
  description: string;
  tag: string;
  tone: "approved" | "blocked" | "hike" | "fx" | "pool";
}

/** The simulator's charges, matching the backend's seeded merchants. */
export const SCENARIOS: ScenarioCard[] = [
  { id: "normal", icon: CheckCircle2, title: "The everyday payment", description: "Spotify · ₦1,300 · Within your limit", tag: "APPROVE", tone: "approved" },
  { id: "paused", icon: ShieldOff, title: "The kill switch", description: "YouTube · ₦1,900 · Merchant paused", tag: "BLOCK", tone: "blocked" },
  { id: "hike", icon: TriangleAlert, title: "The sneaky price hike", description: "Spotify · ₦1,560 · 20% above your limit", tag: "BLOCK", tone: "hike" },
  { id: "fx", icon: Globe, title: "The dollar subscription", description: "ChatGPT · $20 · Just-in-time FX", tag: "AUTO-FX", tone: "fx" },
  { id: "pool", icon: Users, title: "The shared plan", description: "Netflix · ₦7,000 · Pool funds first", tag: "SPLIT", tone: "pool" },
];
