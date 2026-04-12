import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Backend API URL — set via NEXT_PUBLIC_API_URL env var
  // Proxied in dev to avoid CORS issues when calling FastAPI
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    return [
      {
        source: "/api/:path*",
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
