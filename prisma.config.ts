// Prisma 7 CLI configuration (schema location, migrations, datasource URL).
//
// Prisma does NOT auto-load .env files, so we load them here in the same
// precedence Next.js uses: `.env` first, then `.env.local` overrides it.
//
// Runtime application code uses DATABASE_URL (pooled connection).
// Prisma CLI/migrations use DIRECT_URL (direct/non-pooled connection).

import { config as loadEnv } from "dotenv";
import { defineConfig, env } from "prisma/config";

loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // Development/demo seed only. Never run this automatically in production.
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DIRECT_URL"),
  },
});
