import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
  turbopackFileSystemCacheForDev: false,
},
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "flowbite.com",
      },
      {
        protocol: "https",
        hostname: "api.dicebear.com",
      },
    ],
  },
};

export default nextConfig;
