export const workspacePages = {
  shield: {
    href: "/shield", label: "Shield", heading: "Stay in control",
    eyebrow: "YOUR MONEY. YOUR RULES.",
    description: "One card. Every subscription protected. A little more peace of mind.",
  },
  pools: {
    href: "/pools", label: "Pools & Split", heading: "Share the plan",
    eyebrow: "GOOD PLANS ARE BETTER TOGETHER.",
    description: "Split your favourite subscriptions. Keep the friendships simple.",
  },
  insights: {
    href: "/insights", label: "Insights & Vault", heading: "Make money moves",
    eyebrow: "A LITTLE CLARITY GOES A LONG WAY.",
    description: "Smarter conversions, quieter bills, and expenses that organise themselves.",
  },
  transactions: {
    href: "/transactions", label: "Transactions", heading: "Every payment, in view",
    eyebrow: "THE WHOLE STORY. DOWN TO THE KOBO.",
    description: "Your balances, payment history, and the rules behind every decision.",
  },
  settings: {
    href: "/settings", label: "Account settings", heading: "Make it yours",
    eyebrow: "A LITTLE MORE PERSONAL.",
    description: "Your details, your devices, and the way you like things.",
  },
  support: {
    href: "/support", label: "Chat with us", heading: "We’re on your side",
    eyebrow: "A LITTLE HELP GOES A LONG WAY.",
    description: "A question about a payment? Let’s work through it together.",
  },
} as const;

export type WorkspaceSection = keyof typeof workspacePages;
export type AuthMode = "login" | "signup" | "forgot-password" | "reset-password" | "device-binding";
export type AuthSearchParams = Promise<{ next?: string | string[] }>;

// Only known local destinations are accepted by the preview authentication flow.
export function safeDestination(value?: string | string[]): string {
  if (typeof value !== "string") return "/shield";
  if (Object.values(workspacePages).some(page => page.href === value)) return value;
  if (/^\/invite\/[a-zA-Z0-9_-]{1,128}$/.test(value)) return value;
  return "/shield";
}
