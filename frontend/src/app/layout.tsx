import type { Metadata } from "next";
import { AppProviders } from "@/components/providers/AppProviders";
import { themeBootstrapScript } from "@/features/theme/theme";
import "./globals.css";
import "@/features/theme/styles.css";

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
    <html lang="en" data-theme="dark" data-theme-preference="system" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} /></head>
      <body><AppProviders>{children}</AppProviders></body>
    </html>
  );
}
