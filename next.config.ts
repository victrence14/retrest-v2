import type { NextConfig } from "next";

const config: NextConfig = {
  turbopack: { root: process.cwd() },
  serverExternalPackages: ["node:sqlite"],
  devIndicators: false,
};
export default config;
