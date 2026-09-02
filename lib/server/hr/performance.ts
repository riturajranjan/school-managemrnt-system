// Production migration (Phase B, HR Sub-batch 3) — Performance Reviews.
// Deliberately simple: one review record per (staff, reviewer, period), no
// PerformanceCycle/PerformanceGoal/Feedback multi-stage workflow — those stay
// mock (app/hr/appraisals, /goals, /feedback). Real Staff.id relationship for
// both the subject and the reviewer; the reviewer is validated against a
// real, active, in-school Staff record and can never be the reviewee.
//
// visibleToEmployee is an explicit opt-in HR sets on the record — self-
// service (listMyPerformanceReviews) only ever returns a review when BOTH
// status is COMPLETED AND visibleToEmployee is true. A DRAFT/IN_REVIEW
// review, or a COMPLETED one HR never marked visible, is never returned
// there regardless of caller identity.
import { Prisma } from "@/lib/generated/prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import type { ListMeta } from "@/lib/server/api/response";
import { parseInput } from "@/lib/server/validation";
import type { OrgScope } from "@/lib/server/api/scope";
import type { MyPerformanceReviewDto, PerformanceReviewDto, PerformanceReviewStatusDto, PerformanceReviewSummaryDto } from "@/lib/api/contracts";

const STATUS_TO_DTO: Record<string, PerformanceReviewStatusDto> = { DRAFT: "draft", IN_REVIEW: "in-review", COMPLETED: "completed", ARCHIVED: "archived" };
const DTO_TO_STATUS = Object.fromEntries(Object.entries(STATUS_TO_DTO).map(([k, v]) => [v, k])) as Record<PerformanceReviewStatusDto, string>;
const STATUS_VALUES = Object.keys(DTO_TO_STATUS) as [PerformanceReviewStatusDto, ...PerformanceReviewStatusDto[]];

/** Manual HR lifecycle; "archived" is the delete-equivalent — a review is a
 * historical HR record, never hard-deleted. */
export const PERFORMANCE_REVIEW_NEXT_STATUS: Record<PerformanceReviewStatusDto, PerformanceReviewStatusDto[]> = {
  draft: ["in-review", "archived"],
  "in-review": ["completed", "archived"],
  completed: ["archived"],
  archived: [],
};

type Row = {
  id: string;
  staffId: string;
  reviewerId: string;
  reviewPeriodStart: Date;
  reviewPeriodEnd: Date;
  reviewDate: Date | null;
  status: string;
  overallRating: number | null;
  summary: string | null;
  comments: string | null;
  goals: string | null;
  visibleToEmployee: boolean;
  createdByName: string | null;
  updatedByName: string | null;
  createdAt: Date;
  updatedAt: Date;
  staff: { employeeCode: string; firstName: string; lastName: string | null; displayName: string | null };
  reviewer: { firstName: string; lastName: string | null; displayName: string | null };
};

const select = {
  id: true, staffId: true, reviewerId: true, reviewPeriodStart: true, reviewPeriodEnd: true, reviewDate: true,
  status: true, overallRating: true, summary: true, comments: true, goals: true, visibleToEmployee: true,
  createdByName: true, updatedByName: true, createdAt: true, updatedAt: true,
  staff: { select: { employeeCode: true, firstName: true, lastName: true, displayName: true } },
  reviewer: { select: { firstName: true, lastName: true, displayName: true } },
} satisfies Prisma.PerformanceReviewSelect;

function staffName(s: { firstName: string; lastName: string | null; displayName: string | null }): string {
  return s.displayName?.trim() || `${s.firstName} ${s.lastName ?? ""}`.trim();
}

function toDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function dto(row: Row): PerformanceReviewDto {
  return {
    id: row.id,
    staffId: row.staffId,
    staffName: staffName(row.staff),
    employeeCode: row.staff.employeeCode,
    reviewerId: row.reviewerId,
    reviewerName: staffName(row.reviewer),
    reviewPeriodStart: toDate(row.reviewPeriodStart),
    reviewPeriodEnd: toDate(row.reviewPeriodEnd),
    reviewDate: row.reviewDate ? toDate(row.reviewDate) : null,
    status: (STATUS_TO_DTO[row.status] ?? "draft") as PerformanceReviewStatusDto,
    overallRating: row.overallRating,
    summary: row.summary,
    comments: row.comments,
    goals: row.goals,
    visibleToEmployee: row.visibleToEmployee,
    createdByName: row.createdByName,
    updatedByName: row.updatedByName,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function myDto(row: Row): MyPerformanceReviewDto {
  return {
    id: row.id,
    reviewPeriodStart: toDate(row.reviewPeriodStart),
    reviewPeriodEnd: toDate(row.reviewPeriodEnd),
    reviewDate: row.reviewDate ? toDate(row.reviewDate) : null,
    overallRating: row.overallRating,
    summary: row.summary,
    goals: row.goals,
  };
}

async function requireStaffRow(scope: OrgScope, staffId: string): Promise<{ id: string; branchId: string }> {
  const staff = await prisma.staff.findFirst({
    where: { id: staffId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) },
    select: { id: true, branchId: true },
  });
  if (!staff) throw new HttpError("VALIDATION_ERROR", "Staff member not found in this school");
  return staff;
}

/** Reviewer must resolve to a real, active, in-school Staff record and can
 * never be the reviewee — never trust a browser-supplied reviewerId beyond
 * this check. */
async function requireReviewerRow(scope: OrgScope, reviewerId: string, staffId: string): Promise<void> {
  if (reviewerId === staffId) throw new HttpError("VALIDATION_ERROR", "A reviewer cannot review themselves");
  const reviewer = await prisma.staff.findFirst({
    where: { id: reviewerId, schoolId: scope.schoolId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!reviewer) throw new HttpError("VALIDATION_ERROR", "Reviewer must be a real, active staff member in this school");
}

async function requireReviewRow(scope: OrgScope, reviewId: string): Promise<Row> {
  const row = await prisma.performanceReview.findFirst({
    where: { id: reviewId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) },
    select,
  });
  if (!row) throw new HttpError("PERFORMANCE_REVIEW_NOT_FOUND", "Performance review not found");
  return row;
}

export const listPerformanceReviewsSchema = z.object({
  staffId: z.string().min(1).optional(),
  reviewerId: z.string().min(1).optional(),
  status: z.enum(STATUS_VALUES).optional(),
  search: z.string().trim().max(200).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});

/** Search matches the review's own summary plus the subject/reviewer's real
 * Staff name fields — never a free-text field that doesn't exist on the row. */
export async function listPerformanceReviews(scope: OrgScope, raw: unknown = {}): Promise<{ data: PerformanceReviewDto[]; meta: ListMeta }> {
  const input = parseInput(listPerformanceReviewsSchema, raw);
  const where: Prisma.PerformanceReviewWhereInput = { schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) };
  if (input.staffId) where.staffId = input.staffId;
  if (input.reviewerId) where.reviewerId = input.reviewerId;
  if (input.status) where.status = DTO_TO_STATUS[input.status] as never;
  if (input.search) {
    const q = input.search;
    const nameOr = [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { displayName: { contains: q, mode: "insensitive" } },
    ] satisfies Prisma.StaffWhereInput["OR"];
    where.OR = [{ summary: { contains: q, mode: "insensitive" } }, { staff: { OR: nameOr } }, { reviewer: { OR: nameOr } }];
  }
  const [total, rows] = await Promise.all([
    prisma.performanceReview.count({ where }),
    prisma.performanceReview.findMany({ where, select, orderBy: { reviewPeriodStart: "desc" }, skip: (input.page - 1) * input.pageSize, take: input.pageSize }),
  ]);
  return { data: rows.map(dto), meta: { page: input.page, pageSize: input.pageSize, total, totalPages: Math.max(1, Math.ceil(total / input.pageSize)) } };
}

/** Whole-scope status/rating aggregates — deliberately ignores the list's
 * own search/status filter and page so summary tiles never regress to
 * counting only the current page (see production-readiness follow-up). */
export async function getPerformanceReviewSummary(scope: OrgScope): Promise<PerformanceReviewSummaryDto> {
  const where: Prisma.PerformanceReviewWhereInput = { schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) };
  const [grouped, avg] = await Promise.all([
    prisma.performanceReview.groupBy({ by: ["status"], where, _count: { _all: true } }),
    prisma.performanceReview.aggregate({ where: { ...where, overallRating: { not: null } }, _avg: { overallRating: true } }),
  ]);
  const counts = Object.fromEntries(grouped.map((g) => [g.status, g._count._all]));
  const draft = counts.DRAFT ?? 0, inReview = counts.IN_REVIEW ?? 0, completed = counts.COMPLETED ?? 0, archived = counts.ARCHIVED ?? 0;
  return {
    total: draft + inReview + completed + archived,
    draft, inReview, completed, archived,
    averageRating: avg._avg.overallRating !== null ? Math.round(avg._avg.overallRating * 10) / 10 : null,
  };
}

export async function getPerformanceReview(scope: OrgScope, reviewId: string): Promise<PerformanceReviewDto> {
  return dto(await requireReviewRow(scope, reviewId));
}

/** Own-record reads (Employee Self Service) — ONLY completed reviews
 * explicitly marked visibleToEmployee are ever returned. */
export async function listMyPerformanceReviews(scope: OrgScope, staffId: string): Promise<MyPerformanceReviewDto[]> {
  const rows = await prisma.performanceReview.findMany({
    where: { schoolId: scope.schoolId, staffId, status: "COMPLETED", visibleToEmployee: true },
    select,
    orderBy: { reviewPeriodStart: "desc" },
  });
  return rows.map(myDto);
}

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export const createPerformanceReviewSchema = z
  .object({
    staffId: z.string().min(1),
    reviewerId: z.string().min(1),
    reviewPeriodStart: dateSchema,
    reviewPeriodEnd: dateSchema,
    reviewDate: dateSchema.optional(),
    overallRating: z.number().int().min(1).max(5).optional(),
    summary: z.string().trim().max(2000).optional(),
    comments: z.string().trim().max(2000).optional(),
    goals: z.string().trim().max(2000).optional(),
    visibleToEmployee: z.boolean().optional(),
  })
  .refine((v) => v.reviewPeriodEnd >= v.reviewPeriodStart, { message: "Review period end must be on or after the start", path: ["reviewPeriodEnd"] });

export async function createPerformanceReview(scope: OrgScope, raw: unknown): Promise<PerformanceReviewDto> {
  const input = parseInput(createPerformanceReviewSchema, raw);
  const staff = await requireStaffRow(scope, input.staffId);
  await requireReviewerRow(scope, input.reviewerId, input.staffId);
  const row = await prisma.performanceReview.create({
    data: {
      tenantId: scope.tenantId,
      schoolId: scope.schoolId,
      branchId: staff.branchId,
      staffId: staff.id,
      reviewerId: input.reviewerId,
      reviewPeriodStart: new Date(`${input.reviewPeriodStart}T00:00:00Z`),
      reviewPeriodEnd: new Date(`${input.reviewPeriodEnd}T00:00:00Z`),
      reviewDate: input.reviewDate ? new Date(`${input.reviewDate}T00:00:00Z`) : null,
      overallRating: input.overallRating,
      summary: input.summary,
      comments: input.comments,
      goals: input.goals,
      visibleToEmployee: input.visibleToEmployee ?? false,
      createdByUserId: scope.actor.id,
      createdByName: scope.actor.name,
    },
    select,
  });
  await recordAudit(prisma, scope, "PERFORMANCE_REVIEW_CREATED", "PerformanceReview", row.id, { staffId: staff.id, reviewerId: input.reviewerId });
  return dto(row);
}

export const updatePerformanceReviewSchema = z
  .object({
    reviewerId: z.string().min(1).optional(),
    reviewPeriodStart: dateSchema.optional(),
    reviewPeriodEnd: dateSchema.optional(),
    reviewDate: dateSchema.nullable().optional(),
    overallRating: z.number().int().min(1).max(5).nullable().optional(),
    summary: z.string().trim().max(2000).nullable().optional(),
    comments: z.string().trim().max(2000).nullable().optional(),
    goals: z.string().trim().max(2000).nullable().optional(),
    visibleToEmployee: z.boolean().optional(),
  })
  .refine((v) => !v.reviewPeriodStart || !v.reviewPeriodEnd || v.reviewPeriodEnd >= v.reviewPeriodStart, {
    message: "Review period end must be on or after the start",
    path: ["reviewPeriodEnd"],
  });

export async function updatePerformanceReview(scope: OrgScope, reviewId: string, raw: unknown): Promise<PerformanceReviewDto> {
  const input = parseInput(updatePerformanceReviewSchema, raw);
  const existing = await requireReviewRow(scope, reviewId);
  if (input.reviewerId) await requireReviewerRow(scope, input.reviewerId, existing.staffId);
  const row = await prisma.performanceReview.update({
    where: { id: reviewId },
    data: {
      reviewerId: input.reviewerId,
      reviewPeriodStart: input.reviewPeriodStart ? new Date(`${input.reviewPeriodStart}T00:00:00Z`) : undefined,
      reviewPeriodEnd: input.reviewPeriodEnd ? new Date(`${input.reviewPeriodEnd}T00:00:00Z`) : undefined,
      reviewDate: input.reviewDate === undefined ? undefined : input.reviewDate ? new Date(`${input.reviewDate}T00:00:00Z`) : null,
      overallRating: input.overallRating,
      summary: input.summary,
      comments: input.comments,
      goals: input.goals,
      visibleToEmployee: input.visibleToEmployee,
      updatedByUserId: scope.actor.id,
      updatedByName: scope.actor.name,
    },
    select,
  });
  await recordAudit(prisma, scope, "PERFORMANCE_REVIEW_UPDATED", "PerformanceReview", reviewId, input);
  return dto(row);
}

export async function setPerformanceReviewStatus(scope: OrgScope, reviewId: string, status: PerformanceReviewStatusDto): Promise<PerformanceReviewDto> {
  const existing = await requireReviewRow(scope, reviewId);
  const current = (STATUS_TO_DTO[existing.status] ?? "draft") as PerformanceReviewStatusDto;
  if (!PERFORMANCE_REVIEW_NEXT_STATUS[current].includes(status)) {
    throw new HttpError("INVALID_STATUS_TRANSITION", `Cannot move a performance review from "${current}" to "${status}"`);
  }
  const row = await prisma.performanceReview.update({
    where: { id: reviewId },
    data: { status: DTO_TO_STATUS[status] as never, updatedByUserId: scope.actor.id, updatedByName: scope.actor.name },
    select,
  });
  await recordAudit(prisma, scope, "PERFORMANCE_REVIEW_STATUS_CHANGED", "PerformanceReview", reviewId, { status });
  return dto(row);
}

export { STATUS_VALUES as PERFORMANCE_REVIEW_STATUS_VALUES };
