import type { NextConfig } from "next";

const apiInternalUrl = (
  process.env.API_INTERNAL_URL ?? "http://127.0.0.1:3100"
).replace(/\/$/, "");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiInternalUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
