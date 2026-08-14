// Grading scheme configuration (Phase 8C) — real, PostgreSQL-backed
// GradingScheme + GradingBand. School + AcademicSession scoped (not per-Class,
// not per-Exam) — an Exam explicitly picks ONE scheme via Exam.gradingSchemeId
// rather than bands being duplicated per exam or auto-resolved by class. Band
// reconcile is transactional: the complete candidate set is validated first
// (no overlaps, no out-of-range percentages, full band-name uniqueness not
// required), then replaced atomically — never a partial band update.
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { GradingSchemeDto, GradingSchemeStatus } from "@/lib/api/contracts";
import { validateGradingBands } from "./engine";

function requireSession(scope: OrgScope): string {
  if (!scope.academicSessionId) throw new HttpError("INVALID_SESSION", "Select an academic session first");
  return scope.academicSessionId;
}

const schemeSelect = {
  id: true, name: true, status: true,
  bands: { orderBy: { order: "asc" as const }, select: { id: true, label: true, minPercent: true, maxPercent: true, isPass: true, color: true, order: true } },
  _count: { select: { exams: true } },
} satisfies Prisma.GradingSchemeSelect;
type SchemeRow = Prisma.GradingSchemeGetPayload<{ select: typeof schemeSelect }>;

function schemeDto(s: SchemeRow): GradingSchemeDto {
  return { id: s.id, name: s.name, status: s.status.toLowerCase() as GradingSchemeStatus, bands: s.bands, examCount: s._count.exams };
}

export async function listGradingSchemes(scope: OrgScope): Promise<GradingSchemeDto[]> {
  const rows = await prisma.gradingScheme.findMany({
    where: { schoolId: scope.schoolId, academicSessionId: requireSession(scope) },
    orderBy: [{ createdAt: "desc" }],
    select: schemeSelect,
  });
  return rows.map(schemeDto);
}

export async function requireSchemeInScope(scope: OrgScope, schemeId: string): Promise<{ id: string }> {
  const s = await prisma.gradingScheme.findFirst({ where: { id: schemeId, schoolId: scope.schoolId, academicSessionId: requireSession(scope) }, select: { id: true } });
  if (!s) throw new HttpError("GRADING_SCHEME_NOT_FOUND", "Grading scheme not found");
  return s;
}

export const createSchemeSchema = z.object({ name: z.string().trim().min(1).max(80) });
export const updateSchemeSchema = z.object({ name: z.string().trim().min(1).max(80).optional(), status: z.enum(["active", "archived"]).optional() });

export async function createGradingScheme(scope: OrgScope, raw: unknown): Promise<GradingSchemeDto> {
  const input = parseInput(createSchemeSchema, raw);
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.gradingScheme.create({ data: { tenantId: scope.tenantId, schoolId: scope.schoolId, academicSessionId: requireSession(scope), name: input.name }, select: { id: true } });
    await recordAudit(tx, scope, "GRADING_SCHEME_CREATED", "GradingScheme", row.id, { name: input.name });
    return row;
  });
  return schemeDto(await prisma.gradingScheme.findUniqueOrThrow({ where: { id: created.id }, select: schemeSelect }));
}

export async function updateGradingScheme(scope: OrgScope, schemeId: string, raw: unknown): Promise<GradingSchemeDto> {
  const input = parseInput(updateSchemeSchema, raw);
  await requireSchemeInScope(scope, schemeId);
  await prisma.$transaction(async (tx) => {
    await tx.gradingScheme.update({ where: { id: schemeId }, data: { name: input.name, status: input.status ? (input.status.toUpperCase() as never) : undefined } });
    await recordAudit(tx, scope, "GRADING_SCHEME_UPDATED", "GradingScheme", schemeId);
  });
  return schemeDto(await prisma.gradingScheme.findUniqueOrThrow({ where: { id: schemeId }, select: schemeSelect }));
}

const bandInputSchema = z.object({
  label: z.string().trim().min(1).max(30),
  minPercent: z.number().int().min(0).max(100),
  maxPercent: z.number().int().min(0).max(100),
  isPass: z.boolean(),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  order: z.number().int().min(0).max(1000).optional(),
});
export const reconcileBandsSchema = z.object({ bands: z.array(bandInputSchema).min(1).max(30) });

/** Full replace, transactional, validated as one complete candidate set before
 *  anything is written — matches the ClassSubject/ExamClass reconcile
 *  precedent elsewhere in this codebase. */
export async function reconcileGradingBands(scope: OrgScope, schemeId: string, raw: unknown): Promise<GradingSchemeDto> {
  const input = parseInput(reconcileBandsSchema, raw);
  await requireSchemeInScope(scope, schemeId);
  const withOrder = input.bands.map((b, i) => ({ ...b, order: b.order ?? i }));
  const errors = validateGradingBands(withOrder);
  if (errors.length > 0) {
    const code = errors.some((e) => e.includes("overlaps")) ? "GRADING_BAND_OVERLAP" : "INVALID_GRADING_BANDS";
    throw new HttpError(code, errors.join(" "));
  }

  await prisma.$transaction(async (tx) => {
    await tx.gradingBand.deleteMany({ where: { gradingSchemeId: schemeId } });
    await tx.gradingBand.createMany({ data: withOrder.map((b) => ({ gradingSchemeId: schemeId, label: b.label, minPercent: b.minPercent, maxPercent: b.maxPercent, isPass: b.isPass, color: b.color ?? "#18b0c8", order: b.order })) });
    await recordAudit(tx, scope, "GRADING_BANDS_UPDATED", "GradingScheme", schemeId, { bandCount: withOrder.length });
  });
  return schemeDto(await prisma.gradingScheme.findUniqueOrThrow({ where: { id: schemeId }, select: schemeSelect }));
}
