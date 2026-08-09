// Vitest global setup — load env files before any test module is imported, in
// the same precedence Next.js/Prisma use (.env, then .env.local overrides).
// This ensures DATABASE_URL is set before the Prisma singleton initializes in
// DB-backed tests. Harmless for the pure unit tests.
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });
