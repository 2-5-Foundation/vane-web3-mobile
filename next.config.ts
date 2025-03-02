import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  transpilePackages: ['vane_lib'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
  }
};
export default nextConfig;