// Library Books (Phase 9N) — real, PostgreSQL-backed catalog/title records.
// Author/publisher/category are plain text fields (the mock UI's separate
// normalized Author/Publisher/Category entities had no independent
// management need). Availability is always derived from copy status, never
// a stored aggregate.
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { LibraryBookDto, LibraryBookStatusDto } from "@/lib/api/contracts";

const statusToUi = (s: string): LibraryBookStatusDto => s.toLowerCase() as LibraryBookStatusDto;
const STATUS_TO_DB: Record<LibraryBookStatusDto, string> = { active: "ACTIVE", archived: "ARCHIVED" };

export const createBookSchema = z.object({
  title: z.string().trim().min(1).max(300),
  subtitle: z.string().trim().max(300).optional(),
  isbn: z.string().trim().max(32).optional(),
  author: z.string().trim().min(1).max(200),
  publisher: z.string().trim().max(200).optional(),
  publicationYear: z.number().int().min(1000).max(3000).optional(),
  category: z.string().trim().max(100).optional(),
  language: z.string().trim().max(60).optional(),
  description: z.string().trim().max(2000).optional(),
});
export const updateBookSchema = createBookSchema.partial().extend({ status: z.enum(["active", "archived"]).optional() });

type Row = {
  id: string; title: string; subtitle: string | null; isbn: string | null; author: string; publisher: string | null;
  publicationYear: number | null; category: string | null; language: string | null; description: string | null;
  status: string; createdAt: Date; updatedAt: Date;
  copies: { status: string }[];
};
const select = {
  id: true, title: true, subtitle: true, isbn: true, author: true, publisher: true, publicationYear: true,
  category: true, language: true, description: true, status: true, createdAt: true, updatedAt: true,
  copies: { select: { status: true }, where: { status: { not: "ARCHIVED" } } },
} satisfies Prisma.LibraryBookSelect;

function dto(b: Row): LibraryBookDto {
  return {
    id: b.id, title: b.title, subtitle: b.subtitle, isbn: b.isbn, author: b.author, publisher: b.publisher,
    publicationYear: b.publicationYear, category: b.category, language: b.language, description: b.description,
    status: statusToUi(b.status), copyCount: b.copies.length, availableCount: b.copies.filter((c) => c.status === "AVAILABLE").length,
    createdAt: b.createdAt.toISOString(), updatedAt: b.updatedAt.toISOString(),
  };
}

async function requireBookInScope(scope: OrgScope, bookId: string): Promise<{ id: string }> {
  const b = await prisma.libraryBook.findFirst({ where: { id: bookId, schoolId: scope.schoolId }, select: { id: true } });
  if (!b) throw new HttpError("NOT_FOUND", "Book not found");
  return b;
}

export async function listBooks(scope: OrgScope, params: { status?: string; search?: string } = {}): Promise<LibraryBookDto[]> {
  const where: Prisma.LibraryBookWhereInput = { schoolId: scope.schoolId };
  if (params.status && params.status in STATUS_TO_DB) where.status = STATUS_TO_DB[params.status as LibraryBookStatusDto] as never;
  if (params.search?.trim()) {
    const q = params.search.trim();
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { author: { contains: q, mode: "insensitive" } },
      { isbn: { contains: q, mode: "insensitive" } },
    ];
  }
  const rows = await prisma.libraryBook.findMany({ where, orderBy: { title: "asc" }, select });
  return rows.map(dto);
}

export async function getBook(scope: OrgScope, bookId: string): Promise<LibraryBookDto> {
  await requireBookInScope(scope, bookId);
  const b = await prisma.libraryBook.findUniqueOrThrow({ where: { id: bookId }, select });
  return dto(b);
}

export async function createBook(scope: OrgScope, raw: unknown): Promise<LibraryBookDto> {
  const input = parseInput(createBookSchema, raw);
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.libraryBook.create({
      data: {
        tenantId: scope.tenantId, schoolId: scope.schoolId, title: input.title, subtitle: input.subtitle, isbn: input.isbn,
        author: input.author, publisher: input.publisher, publicationYear: input.publicationYear, category: input.category,
        language: input.language, description: input.description,
      },
      select,
    });
    await recordAudit(tx, scope, "LIBRARY_BOOK_CREATED", "LibraryBook", row.id, { title: row.title });
    return row;
  });
  return dto(created);
}

export async function updateBook(scope: OrgScope, bookId: string, raw: unknown): Promise<LibraryBookDto> {
  const input = parseInput(updateBookSchema, raw);
  await requireBookInScope(scope, bookId);
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.libraryBook.update({
      where: { id: bookId },
      data: {
        title: input.title, subtitle: input.subtitle, isbn: input.isbn, author: input.author, publisher: input.publisher,
        publicationYear: input.publicationYear, category: input.category, language: input.language, description: input.description,
        status: input.status ? (STATUS_TO_DB[input.status] as never) : undefined,
      },
      select,
    });
    await recordAudit(tx, scope, "LIBRARY_BOOK_UPDATED", "LibraryBook", bookId);
    return row;
  });
  return dto(updated);
}
