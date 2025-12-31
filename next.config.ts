import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const nextConfig: NextConfig = {
  // ✅ Force Turbopack to treat THIS app folder as root
  turbopack: {
    root: __dirname,
  },

  // Your existing config
  transpilePackages: ["vane_lib"],
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
    domains: ["assets.coingecko.com", "api.sim.dune.com"],
  },
  skipTrailingSlashRedirect: true,

  // ✅ Your headers block from the JS config
  async headers() {
    const frameAncestors =
      "frame-ancestors 'self' https://*.base.org https://base.org https://build.base.org https://app.base.org https://*.base.dev https://base.dev https://www.base.dev https://*.farcaster.xyz https://farcaster.xyz https://warpcast.com https://*.warpcast.com";

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Content-Security-Policy", value: frameAncestors },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
