import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@noirly-dev/realtime-client",
    "@noirly-dev/realtime-shared",
  ],
};

export default nextConfig;
