// Decimal-safe money helpers for the Fees domain (Phase 9F). Mirrors the
// Super Admin billing domain's Prisma.Decimal convention exactly (see
// lib/server/platform/payments-service.ts) — never a JS float as financial
// authority. `dec()` is the only place a Decimal becomes a plain number, and
// it only happens at the DTO boundary.
import { Prisma } from "@/lib/generated/prisma/client";

export const dec = (d: Prisma.Decimal | number | null | undefined): number => (d === null || d === undefined ? 0 : Number(d));

export const money = (n: number): Prisma.Decimal => new Prisma.Decimal(n);

export const ZERO = new Prisma.Decimal(0);

export function round2(d: Prisma.Decimal): Prisma.Decimal {
  return d.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}
