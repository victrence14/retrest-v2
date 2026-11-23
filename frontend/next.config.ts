import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

/** Express owns demo/provider routes; Next handles account cookies before forwarding. */
const API_URL = (process.env.API_URL ?? "http://127.0.0.1:3001").replace(
  /\/$/,
  "",
);

const config: NextConfig = {
  // The repository root, so Turbopack can resolve ../shared (domain types shared with the backend).
  turbopack: { root: fileURLToPath(new URL("..", import.meta.url)) },
  devIndicators: false,
  // Match account/auth Route Handlers before proxying the remaining demo/provider APIs.
  async rewrites() {
    return { fallback: [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }] };
  },
};

export default config;
