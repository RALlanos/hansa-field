import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.100.34"],
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
