import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RETREST — Your money. Your rules.",
  description:
    "One card. Every subscription protected. Take control of recurring payments, split bills, and automate your NGN and USD treasury.",
  icons: { icon: "/icon.svg" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
