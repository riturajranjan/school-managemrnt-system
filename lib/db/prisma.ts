// Server-only Prisma Client singleton.
//
// Prisma 7 requires a driver adapter (no bundled query-engine binary). We use
// `@prisma/adapter-pg` over the `pg` driver. A single instance is reused per
// process (and cached on `globalThis` in dev so Next.js HMR does not open a new
// connection pool on every reload).
//
// Do NOT import this module from a Client Component — it opens real database
// connections. The guard below fails fast if that ever happens.
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";

if (typeof window !== "undefined") {
  throw new Error(
    "lib/db/prisma.ts is server-only and must not be imported from client code.",
  );
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Configure it in .env.local (see .env.example).",
  );
}

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
