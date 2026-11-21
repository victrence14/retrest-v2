import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

/** Express backend that owns every /api route. Server-side only. */
const API_URL = (process.env.API_URL ?? "http://127.0.0.1:3001").replace(
  /\/$/,
  "",
);

const config: NextConfig = {
  // The repository root, so Turbopack can resolve ../shared (domain types shared with the backend).
  turbopack: { root: fileURLToPath(new URL("..", import.meta.url)) },
  devIndicators: false,
  // The browser only ever calls same-origin /api; Next proxies it to the backend with cookies intact.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }];
  },
};

export default config;
