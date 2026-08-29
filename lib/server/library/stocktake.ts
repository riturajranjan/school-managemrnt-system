// Library Stocktake (production migration, Phase A) — a real session over
// the real LibraryBookCopy register. Expected/scanned/missing are always
// DERIVED live from real rows (which copies are AVAILABLE in scope, which
// have a real LibraryStocktakeScan) — never a stored/simulated count. At
// most one IN_PROGRESS stocktake per school at a time, mirroring the
// one-active-session pattern used elsewhere in this codebase (e.g. asset
// assignments, library loans).
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { LibraryStocktakeCopyDto, LibraryStocktakeDetailDto, LibraryStocktakeDto } from "@/lib/api/contracts";
import { resolveLibraryBranch } from "./access";

const listSelect = {
  id: true, reference: true, scope: true, shelfLocation: true, status: true, startedAt: true, completedAt: true,
  startedByUser: { select: { name: true, email: true } },
  _count: { select: { scans: true } },
} satisfies Prisma.LibraryStocktakeSelect;

type ListRow = Prisma.LibraryStocktakeGetPayload<{ select: typeof listSelect }>;

async function expectedCount(scope: OrgScope, shelfLocation: string | null): Promise<number> {
  return prisma.libraryBookCopy.count({
    where: { schoolId: scope.schoolId, status: "AVAILABLE", ...(shelfLocation ? { shelfLocation } : {}) },
  });
}

async function summaryDto(scope: OrgScope, row: ListRow): Promise<LibraryStocktakeDto> {
  const expected = await expectedCount(scope, row.shelfLocation);
  return {
    id: row.id, reference: row.reference, scope: row.scope.toLowerCase() as LibraryStocktakeDto["scope"],
    shelfLocation: row.shelfLocation, status: row.status.toLowerCase() as LibraryStocktakeDto["status"],
    startedByName: row.startedByUser.name ?? row.startedByUser.email,
    startedAt: row.startedAt.toISOString(), completedAt: row.completedAt?.toISOString() ?? null,
    expectedCount: expected, scannedCount: row._count.scans, missingCount: Math.max(0, expected - row._count.scans),
  };
}

export async function listStocktakes(scope: OrgScope): Promise<LibraryStocktakeDto[]> {
  const rows = await prisma.libraryStocktake.findMany({ where: { schoolId: scope.schoolId }, select: listSelect, orderBy: { startedAt: "desc" } });
  return Promise.all(rows.map((r) => summaryDto(scope, r)));
}

export async function getStocktake(scope: OrgScope, stocktakeId: string): Promise<LibraryStocktakeDetailDto> {
  const row = await prisma.libraryStocktake.findFirst({ where: { id: stocktakeId, schoolId: scope.schoolId }, select: listSelect });
  if (!row) throw new HttpError("NOT_FOUND", "Stocktake not found");
  const summary = await summaryDto(scope, row);

  const [scanned, allExpected] = await Promise.all([
    prisma.libraryStocktakeScan.findMany({
      where: { stocktakeId },
      select: { scannedAt: true, copy: { select: { id: true, accessionNumber: true, book: { select: { title: true } } } } },
      orderBy: { scannedAt: "desc" },
    }),
    prisma.libraryBookCopy.findMany({
      where: { schoolId: scope.schoolId, status: "AVAILABLE", ...(row.shelfLocation ? { shelfLocation: row.shelfLocation } : {}) },
      select: { id: true, accessionNumber: true, book: { select: { title: true } } },
    }),
  ]);

  const scannedIds = new Set(scanned.map((s) => s.copy.id));
  const scannedCopies: LibraryStocktakeCopyDto[] = scanned.map((s) => ({ id: s.copy.id, accessionNumber: s.copy.accessionNumber, bookTitle: s.copy.book.title, scannedAt: s.scannedAt.toISOString() }));
  const missingCopies: LibraryStocktakeCopyDto[] = allExpected.filter((c) => !scannedIds.has(c.id)).map((c) => ({ id: c.id, accessionNumber: c.accessionNumber, bookTitle: c.book.title, scannedAt: null }));

  return { ...summary, scannedCopies, missingCopies };
}

export const startStocktakeSchema = z.object({ scope: z.enum(["shelf", "full"]), shelfLocation: z.string().trim().min(1).max(120).optional() });

function generateReference(): string {
  return `STK-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export async function startStocktake(scope: OrgScope, raw: unknown): Promise<LibraryStocktakeDetailDto> {
  const input = parseInput(startStocktakeSchema, raw);
  if (input.scope === "shelf" && !input.shelfLocation) throw new HttpError("VALIDATION_ERROR", "Select a shelf location for a shelf stocktake");

  const active = await prisma.libraryStocktake.findFirst({ where: { schoolId: scope.schoolId, status: "IN_PROGRESS" }, select: { id: true } });
  if (active) throw new HttpError("LIBRARY_STOCKTAKE_ALREADY_ACTIVE", "A stocktake is already in progress — complete it before starting another");

  const branchId = await resolveLibraryBranch(scope);
  const id = await prisma.$transaction(async (tx) => {
    const row = await tx.libraryStocktake.create({
      data: {
        tenantId: scope.tenantId, schoolId: scope.schoolId, branchId,
        reference: generateReference(), scope: input.scope.toUpperCase() as never,
        shelfLocation: input.scope === "shelf" ? input.shelfLocation : null, startedByUserId: scope.actor.id,
      },
      select: { id: true },
    });
    await recordAudit(tx, scope, "LIBRARY_STOCKTAKE_STARTED", "LibraryStocktake", row.id, { scope: input.scope });
    return row.id;
  });
  return getStocktake(scope, id);
}

export const scanStocktakeSchema = z.object({ code: z.string().trim().min(1) });

export async function scanStocktakeItem(scope: OrgScope, stocktakeId: string, raw: unknown): Promise<LibraryStocktakeDetailDto> {
  const input = parseInput(scanStocktakeSchema, raw);
  const stocktake = await prisma.libraryStocktake.findFirst({ where: { id: stocktakeId, schoolId: scope.schoolId }, select: { id: true, status: true } });
  if (!stocktake) throw new HttpError("NOT_FOUND", "Stocktake not found");
  if (stocktake.status !== "IN_PROGRESS") throw new HttpError("LIBRARY_STOCKTAKE_NOT_ACTIVE", "This stocktake is already completed");

  const code = input.code.trim();
  const copy = await prisma.libraryBookCopy.findFirst({
    where: { schoolId: scope.schoolId, OR: [{ barcode: code }, { accessionNumber: code }] },
    select: { id: true },
  });
  if (!copy) throw new HttpError("NOT_FOUND", "No copy matches this barcode or accession number");

  // Re-scanning the same copy is a no-op, not a duplicate row (unique constraint).
  await prisma.libraryStocktakeScan.upsert({
    where: { stocktakeId_copyId: { stocktakeId, copyId: copy.id } },
    create: { stocktakeId, copyId: copy.id },
    update: {},
  });
  return getStocktake(scope, stocktakeId);
}

export async function completeStocktake(scope: OrgScope, stocktakeId: string): Promise<LibraryStocktakeDetailDto> {
  const stocktake = await prisma.libraryStocktake.findFirst({ where: { id: stocktakeId, schoolId: scope.schoolId }, select: { id: true, status: true } });
  if (!stocktake) throw new HttpError("NOT_FOUND", "Stocktake not found");
  if (stocktake.status !== "IN_PROGRESS") throw new HttpError("LIBRARY_STOCKTAKE_NOT_ACTIVE", "This stocktake is already completed");

  await prisma.$transaction(async (tx) => {
    await tx.libraryStocktake.update({ where: { id: stocktakeId }, data: { status: "COMPLETED", completedAt: new Date() } });
    await recordAudit(tx, scope, "LIBRARY_STOCKTAKE_COMPLETED", "LibraryStocktake", stocktakeId);
  });
  return getStocktake(scope, stocktakeId);
}
