// Digital Library (production migration, Phase A) — real resource records.
// `url` is always an external link: this system has no file/object storage
// integration anywhere, so a resource is never claimed to be "uploaded" —
// it's a real, admin-entered link to wherever the school already hosts it.
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { LibraryDigitalResourceDto } from "@/lib/api/contracts";
import { resolveLibraryBranch } from "./access";

const select = {
  id: true, title: true, subject: true, type: true, url: true, accessLevel: true, createdAt: true,
  uploadedByUser: { select: { name: true, email: true } },
} satisfies Prisma.LibraryDigitalResourceSelect;

type Row = Prisma.LibraryDigitalResourceGetPayload<{ select: typeof select }>;

function dto(r: Row): LibraryDigitalResourceDto {
  return {
    id: r.id, title: r.title, subject: r.subject, type: r.type.toLowerCase() as LibraryDigitalResourceDto["type"],
    url: r.url, accessLevel: r.accessLevel.toLowerCase() as LibraryDigitalResourceDto["accessLevel"],
    uploadedByName: r.uploadedByUser.name ?? r.uploadedByUser.email, createdAt: r.createdAt.toISOString(),
  };
}

export async function listDigitalResources(scope: OrgScope, params: { search?: string } = {}): Promise<LibraryDigitalResourceDto[]> {
  const where: Prisma.LibraryDigitalResourceWhereInput = { schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) };
  if (params.search) {
    const q = params.search.trim();
    where.OR = [{ title: { contains: q, mode: "insensitive" } }, { subject: { contains: q, mode: "insensitive" } }];
  }
  const rows = await prisma.libraryDigitalResource.findMany({ where, select, orderBy: { createdAt: "desc" } });
  return rows.map(dto);
}

export const createDigitalResourceSchema = z.object({
  title: z.string().trim().min(1).max(200),
  subject: z.string().trim().max(120).optional(),
  type: z.enum(["ebook", "notes", "question_paper", "audio", "video", "other"]),
  url: z.string().trim().url().max(2000),
  accessLevel: z.enum(["all", "students", "staff"]).optional(),
});

export async function createDigitalResource(scope: OrgScope, raw: unknown): Promise<LibraryDigitalResourceDto> {
  const input = parseInput(createDigitalResourceSchema, raw);
  const branchId = await resolveLibraryBranch(scope);
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.libraryDigitalResource.create({
      data: {
        tenantId: scope.tenantId, schoolId: scope.schoolId, branchId,
        title: input.title, subject: input.subject, type: input.type.toUpperCase() as never, url: input.url,
        accessLevel: input.accessLevel ? (input.accessLevel.toUpperCase() as never) : undefined,
        uploadedByUserId: scope.actor.id,
      },
      select,
    });
    await recordAudit(tx, scope, "LIBRARY_DIGITAL_RESOURCE_CREATED", "LibraryDigitalResource", row.id, { title: input.title });
    return row;
  });
  return dto(created);
}

export async function deleteDigitalResource(scope: OrgScope, resourceId: string): Promise<void> {
  const row = await prisma.libraryDigitalResource.findFirst({ where: { id: resourceId, schoolId: scope.schoolId }, select: { id: true } });
  if (!row) throw new HttpError("NOT_FOUND", "Resource not found");
  await prisma.$transaction(async (tx) => {
    await tx.libraryDigitalResource.delete({ where: { id: resourceId } });
    await recordAudit(tx, scope, "LIBRARY_DIGITAL_RESOURCE_DELETED", "LibraryDigitalResource", resourceId);
  });
}
