import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/pdf",
        destination: "/",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
