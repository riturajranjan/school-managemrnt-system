// Library Book Copies (Phase 9N) — real, PostgreSQL-backed lendable physical
// items, separate from the LibraryBook title. Accession numbers are server-
// generated and race-safe (see accession-number.ts) — never Math.random().
// Shelf location is a plain optional text field, not a normalized Shelf
// hierarchy (no independent management need was found in the audit).
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { LibraryBookCopyDto, LibraryCopyStatusDto } from "@/lib/api/contracts";
import { resolveLibraryBranch } from "./access";
import { nextAccessionNumber } from "./accession-number";

const statusToUi = (s: string): LibraryCopyStatusDto => s.toLowerCase() as LibraryCopyStatusDto;

type Row = {
  id: string; bookId: string; accessionNumber: string; barcode: string | null; status: string;
  acquiredAt: Date | null; shelfLocation: string | null; notes: string | null; createdAt: Date; updatedAt: Date;
  book: { title: string };
};
const select = {
  id: true, bookId: true, accessionNumber: true, barcode: true, status: true, acquiredAt: true, shelfLocation: true,
  notes: true, createdAt: true, updatedAt: true, book: { select: { title: true } },
} satisfies Prisma.LibraryBookCopySelect;

function dto(c: Row): LibraryBookCopyDto {
  return {
    id: c.id, bookId: c.bookId, bookTitle: c.book.title, accessionNumber: c.accessionNumber, barcode: c.barcode,
    status: statusToUi(c.status), acquiredAt: c.acquiredAt?.toISOString() ?? null, shelfLocation: c.shelfLocation,
    notes: c.notes, createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString(),
  };
}

export async function requireCopyInScope(scope: OrgScope, copyId: string): Promise<Row> {
  const c = await prisma.libraryBookCopy.findFirst({
    where: { id: copyId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) },
    select,
  });
  if (!c) throw new HttpError("NOT_FOUND", "Copy not found");
  return c;
}

export async function getCopy(scope: OrgScope, copyId: string): Promise<LibraryBookCopyDto> {
  return dto(await requireCopyInScope(scope, copyId));
}

export async function listCopies(scope: OrgScope, params: { bookId?: string; status?: string; search?: string } = {}): Promise<LibraryBookCopyDto[]> {
  const where: Prisma.LibraryBookCopyWhereInput = { schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) };
  if (params.bookId) where.bookId = params.bookId;
  if (params.status) where.status = params.status.toUpperCase() as never;
  if (params.search) {
    const q = params.search.trim();
    where.OR = [
      { accessionNumber: { contains: q, mode: "insensitive" } },
      { barcode: { contains: q, mode: "insensitive" } },
      { shelfLocation: { contains: q, mode: "insensitive" } },
      { book: { title: { contains: q, mode: "insensitive" } } },
    ];
  }
  const rows = await prisma.libraryBookCopy.findMany({ where, orderBy: { accessionNumber: "asc" }, select });
  return rows.map(dto);
}

export const createCopySchema = z.object({
  barcode: z.string().trim().max(64).optional(),
  shelfLocation: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(500).optional(),
  acquiredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function createCopy(scope: OrgScope, bookId: string, raw: unknown): Promise<LibraryBookCopyDto> {
  const input = parseInput(createCopySchema, raw);
  const book = await prisma.libraryBook.findFirst({ where: { id: bookId, schoolId: scope.schoolId }, select: { id: true } });
  if (!book) throw new HttpError("NOT_FOUND", "Book not found");
  const branchId = await resolveLibraryBranch(scope);
  const created = await prisma.$transaction(async (tx) => {
    const accessionNumber = await nextAccessionNumber(tx, scope.schoolId);
    const row = await tx.libraryBookCopy.create({
      data: {
        tenantId: scope.tenantId, schoolId: scope.schoolId, branchId, bookId, accessionNumber,
        barcode: input.barcode, shelfLocation: input.shelfLocation, notes: input.notes,
        acquiredAt: input.acquiredAt ? new Date(`${input.acquiredAt}T00:00:00.000Z`) : undefined,
      },
      select,
    });
    await recordAudit(tx, scope, "LIBRARY_COPY_CREATED", "LibraryBookCopy", row.id, { accessionNumber: row.accessionNumber });
    return row;
  });
  return dto(created);
}

export const updateCopySchema = z.object({ barcode: z.string().trim().max(64).optional(), shelfLocation: z.string().trim().max(120).optional(), notes: z.string().trim().max(500).optional() });

export async function updateCopy(scope: OrgScope, copyId: string, raw: unknown): Promise<LibraryBookCopyDto> {
  const input = parseInput(updateCopySchema, raw);
  await requireCopyInScope(scope, copyId);
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.libraryBookCopy.update({ where: { id: copyId }, data: { barcode: input.barcode, shelfLocation: input.shelfLocation, notes: input.notes }, select });
    await recordAudit(tx, scope, "LIBRARY_COPY_UPDATED", "LibraryBookCopy", copyId);
    return row;
  });
  return dto(updated);
}

/** Standalone status change for a copy NOT currently on loan — e.g. a copy
 *  found damaged during shelving, or archiving a withdrawn copy. Issue/
 *  return/lost-while-out flows go through loans.ts instead, which also
 *  closes the associated loan. */
export async function setCopyStatus(scope: OrgScope, copyId: string, status: Extract<LibraryCopyStatusDto, "available" | "damaged" | "archived">): Promise<LibraryBookCopyDto> {
  const copy = await requireCopyInScope(scope, copyId);
  if (copy.status === "ISSUED") throw new HttpError("VALIDATION_ERROR", "This copy is currently on loan — return it first");
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.libraryBookCopy.update({ where: { id: copyId }, data: { status: status.toUpperCase() as never }, select });
    await recordAudit(tx, scope, status === "damaged" ? "LIBRARY_COPY_MARKED_DAMAGED" : "LIBRARY_COPY_UPDATED", "LibraryBookCopy", copyId, { status });
    return row;
  });
  return dto(updated);
}
