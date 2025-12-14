import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverComponentsExternalPackages: [
      "knex",
      "pg",
      "crockroachdb-queue-producer-consumer",
    ],
  },
};

export default nextConfig;
