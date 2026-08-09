// Prisma 7 CLI configuration (schema location, migrations, datasource URL).
//
// Prisma does NOT auto-load .env files, so we load them here in the same
// precedence Next.js uses: `.env` first, then `.env.local` overrides it.
// The real development DATABASE_URL lives in .env.local (git-ignored); .env
// only carries a safe localhost placeholder.
import { config as loadEnv } from "dotenv";
import { defineConfig, env } from "prisma/config";

loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // TS seed runner (tsx handles the ESM generated client transparently).
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
    // If a pooled provider is used later, set DIRECT_URL for migrations:
    // directUrl: env("DIRECT_URL"),
  },
});
