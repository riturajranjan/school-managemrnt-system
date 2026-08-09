import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Prisma + the native `pg` driver out of the server bundle so they run
  // from node_modules at runtime (native bindings must not be bundled).
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg"],
};

export default nextConfig;
