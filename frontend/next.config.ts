import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { hostname: "localhost" },
      { hostname: "*.onrender.com" },
      { hostname: "*.supabase.co" },
    ],
  },
};

export default nextConfig;
