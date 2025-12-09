import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  transpilePackages: ['vane_lib'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
    domains: ['api.sim.dune.com', 'assets.coingecko.com'],
  },
  skipTrailingSlashRedirect: true,
};
export default nextConfig;
