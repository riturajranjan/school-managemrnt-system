// Prisma 7 config. The datasource URL and migration/seed wiring live here
// (not in schema.prisma). `.env` is loaded explicitly via dotenv.
import "dotenv/config";
import { defineConfig } from "prisma/config";

// Migrations run against a DIRECT (non-pooled) connection when the provider
// pools (e.g. Neon/Supabase pgbouncer); fall back to DATABASE_URL otherwise.
const migrationUrl = process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"];

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // Seed runs under Node 20+ via tsx (see package.json db:seed / db:setup).
    seed: "node --import tsx prisma/seed.ts",
  },
  datasource: {
    url: migrationUrl,
    shadowDatabaseUrl: process.env["SHADOW_DATABASE_URL"],
  },
});
