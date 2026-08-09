import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    // Category images are entered as URLs from the admin page, so the host is not
    // known ahead of time. Only https is accepted (see lib/category-input.ts).
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;
