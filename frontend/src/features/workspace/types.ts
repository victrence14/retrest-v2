import type { Subscription } from "@retrest/shared";

/** Which workspace dialog is open. Exactly one at a time. */
export type WorkspaceDialog =
  | { kind: "demo" }
  | { kind: "fund" }
  | { kind: "add" }
  | { kind: "create-pool"; subscriptionId?: string }
  | { kind: "notifications" }
  | { kind: "help" }
  | { kind: "chat" }
  | { kind: "summary" }
  | { kind: "merchant"; subscription: Subscription };

export type DialogKind = WorkspaceDialog["kind"];

export interface Profile {
  name: string;
  email: string;
  phone: string;
}
