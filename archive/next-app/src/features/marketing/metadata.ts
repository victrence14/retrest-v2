import type { Metadata } from "next";

/** FE1 can import this into the landing route/root metadata without guessing claims. */
export const pitchMetadata: Metadata = {
  title: "RETREST — Recurring payment control demo",
  description: "Explore RETREST’s recurring payment demo: merchant rules, shared pools, simulated NGN/USD funding, and downloadable business receipts.",
  openGraph: {
    title: "RETREST — Your subscriptions. Your rules.",
    description: "Try merchant controls, shared plans, simulated payments and complete monthly business receipt exports.",
    type: "website",
  },
};
