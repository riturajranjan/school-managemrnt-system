import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { getEnv } from "@/lib/env";

// ---------------------------------------------------------------------------
// Development-safe Prisma singleton. Next.js hot-reload re-imports modules, so
// without caching on globalThis we'd open a new connection pool per reload and
// exhaust the database. Prisma 7 connects through a driver adapter (@prisma/
// adapter-pg) rather than a built-in engine URL.
//
// This module is server-only. Never import it from a client component.
// ---------------------------------------------------------------------------

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: getEnv().DATABASE_URL });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
