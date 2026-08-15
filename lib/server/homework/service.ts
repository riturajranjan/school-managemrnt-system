// Homework / Assignments (Phase 9B) — real, PostgreSQL-backed. One Homework
// targets exactly one real Section; students see published homework through
// real Enrollment(status=ENROLLED), never a duplicated per-student row.
//
// AUTHORSHIP: User -> Staff.userId -> Staff, with a real TeachingAssignment
// for (sectionId, subjectId) — mirrors the Phase 8B marks-entry ownership
// pattern exactly (lib/server/exams/marks-service.ts's canActorEnterMarks).
// SCHOOL_ADMIN/PRINCIPAL are a broad manager for EDIT/PUBLISH/CLOSE (may act
// on any teacher's homework), but CREATE still requires the actor themselves
// to be a real, ACTIVE, teaching Staff member with that TeachingAssignment —
// nobody may invent or impersonate another teacher's authorship.
//
// LIFECYCLE: DRAFT -> PUBLISHED -> CLOSED. Only title/description/
// instructions/dueAt are ever editable (the update schema simply has no
// section/subject/staff fields, so a structural edit is impossible by
// construction, not just rejected at runtime). Submissions/grading/
// attachments/parent-acknowledgement are NOT modeled — see the schema's
// Homework doc comment.
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { ListMeta } from "@/lib/server/api/response";
import type { AssignableTeachingDto, HomeworkDetailDto, HomeworkListItemDto, HomeworkStatusDto } from "@/lib/api/contracts";
import { getCurrentStaffProfile } from "@/lib/server/staff/service";

function requireSession(scope: OrgScope): string {
  if (!scope.academicSessionId) throw new HttpError("INVALID_SESSION", "Select an academic session first");
  return scope.academicSessionId;
}

const STATUS_TO_DB: Record<HomeworkStatusDto, string> = { draft: "DRAFT", published: "PUBLISHED", closed: "CLOSED" };
const statusToUi = (s: string): HomeworkStatusDto => s.toLowerCase() as HomeworkStatusDto;
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

// ── Authorization (mirrors marks-service.ts's canActorEnterMarks) ───────────

async function isBroadHomeworkManager(scope: OrgScope): Promise<boolean> {
  const m = await prisma.roleAssignment.findFirst({
    where: { membership: { userId: scope.actor.id, tenantId: scope.tenantId, status: "ACTIVE" }, role: { key: { in: ["SCHOOL_ADMIN", "PRINCIPAL"] } } },
    select: { id: true },
  });
  return Boolean(m);
}

// ── DTO ──────────────────────────────────────────────────────────────────

const listSelect = {
  id: true, title: true, status: true, dueAt: true, createdAt: true, updatedAt: true,
  section: { select: { id: true, name: true, classId: true, class: { select: { name: true } } } },
  subject: { select: { id: true, code: true, name: true, color: true } },
  staff: { select: { id: true, firstName: true, lastName: true, displayName: true } },
} satisfies Prisma.HomeworkSelect;
type ListRow = Prisma.HomeworkGetPayload<{ select: typeof listSelect }>;

const dateToUi = (d: Date) => d.toISOString().slice(0, 10);
function staffName(s: { firstName: string; lastName: string | null; displayName: string | null }): string {
  return s.displayName?.trim() || `${s.firstName} ${s.lastName ?? ""}`.trim();
}

function listItemDto(row: ListRow, studentCount: number): HomeworkListItemDto {
  return {
    id: row.id, title: row.title, status: statusToUi(row.status), dueAt: dateToUi(row.dueAt),
    section: { id: row.section.id, name: row.section.name, classId: row.section.classId, className: row.section.class.name },
    subject: { id: row.subject.id, code: row.subject.code, name: row.subject.name, color: row.subject.color },
    teacher: { id: row.staff.id, name: staffName(row.staff) },
    studentCount, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
  };
}

async function enrolledCounts(sectionIds: string[]): Promise<Map<string, number>> {
  if (sectionIds.length === 0) return new Map();
  const rows = await prisma.enrollment.groupBy({ by: ["sectionId"], where: { sectionId: { in: sectionIds }, status: "ENROLLED" }, _count: { _all: true } });
  return new Map(rows.map((r) => [r.sectionId, r._count._all]));
}

// ── Assignable (real TeachingAssignments for the actor) ─────────────────────

export async function listAssignableTeaching(scope: OrgScope): Promise<AssignableTeachingDto[]> {
  const staff = await getCurrentStaffProfile(scope);
  if (!staff || !staff.isTeaching) return [];
  const rows = await prisma.teachingAssignment.findMany({
    where: { staffId: staff.id, schoolId: scope.schoolId, academicSessionId: requireSession(scope) },
    orderBy: [{ section: { class: { order: "asc" } } }, { section: { name: "asc" } }],
    select: { id: true, section: { select: { id: true, name: true, classId: true, class: { select: { name: true } } } }, subject: { select: { id: true, code: true, name: true, color: true } } },
  });
  return rows.map((r) => ({
    teachingAssignmentId: r.id,
    section: { id: r.section.id, name: r.section.name, classId: r.section.classId, className: r.section.class.name },
    subject: { id: r.subject.id, code: r.subject.code, name: r.subject.name, color: r.subject.color },
  }));
}

// ── List / detail ────────────────────────────────────────────────────────

export const listHomeworkSchema = z.object({
  sectionId: z.string().min(1).optional(),
  subjectId: z.string().min(1).optional(),
  staffId: z.string().min(1).optional(),
  status: z.enum(["draft", "published", "closed"]).optional(),
  dueFrom: dateStr.optional(),
  dueTo: dateStr.optional(),
  search: z.string().trim().min(1).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});

export async function listHomework(scope: OrgScope, raw: unknown): Promise<{ data: HomeworkListItemDto[]; meta: ListMeta }> {
  const input = parseInput(listHomeworkSchema, raw);
  const where: Prisma.HomeworkWhereInput = {
    schoolId: scope.schoolId, academicSessionId: requireSession(scope),
    ...(input.sectionId ? { sectionId: input.sectionId } : {}),
    ...(input.subjectId ? { subjectId: input.subjectId } : {}),
    ...(input.staffId ? { staffId: input.staffId } : {}),
    ...(input.status ? { status: STATUS_TO_DB[input.status] as never } : {}),
    ...(input.dueFrom || input.dueTo
      ? { dueAt: { ...(input.dueFrom ? { gte: new Date(`${input.dueFrom}T00:00:00.000Z`) } : {}), ...(input.dueTo ? { lte: new Date(`${input.dueTo}T00:00:00.000Z`) } : {}) } }
      : {}),
    ...(input.search ? { title: { contains: input.search, mode: "insensitive" } } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.homework.count({ where }),
    prisma.homework.findMany({ where, select: listSelect, orderBy: [{ dueAt: "asc" }], skip: (input.page - 1) * input.pageSize, take: input.pageSize }),
  ]);
  const counts = await enrolledCounts([...new Set(rows.map((r) => r.section.id))]);
  return {
    data: rows.map((r) => listItemDto(r, counts.get(r.section.id) ?? 0)),
    meta: { page: input.page, pageSize: input.pageSize, total, totalPages: Math.max(1, Math.ceil(total / input.pageSize)) },
  };
}

/** The actor's own homework — resolves their real Staff.id server-side so
 *  the client never needs to know (or claim) its own staffId. Empty for
 *  anyone with no real teaching Staff profile. */
export async function listMyHomework(scope: OrgScope, raw: unknown): Promise<{ data: HomeworkListItemDto[]; meta: ListMeta }> {
  const staff = await getCurrentStaffProfile(scope);
  if (!staff) return { data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 } };
  return listHomework(scope, { ...(raw as object), staffId: staff.id });
}

async function requireHomeworkInScope(scope: OrgScope, homeworkId: string) {
  const row = await prisma.homework.findFirst({
    where: { id: homeworkId, schoolId: scope.schoolId, academicSessionId: requireSession(scope) },
    select: { ...listSelect, description: true, instructions: true },
  });
  if (!row) throw new HttpError("NOT_FOUND", "Homework not found");
  return row;
}

export async function getHomework(scope: OrgScope, homeworkId: string): Promise<HomeworkDetailDto> {
  const row = await requireHomeworkInScope(scope, homeworkId);
  const counts = await enrolledCounts([row.section.id]);
  return { ...listItemDto(row, counts.get(row.section.id) ?? 0), description: row.description, instructions: row.instructions };
}

// ── Create ───────────────────────────────────────────────────────────────

export const createHomeworkSchema = z.object({
  sectionId: z.string().min(1),
  subjectId: z.string().min(1),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(4000),
  instructions: z.string().trim().max(4000).optional(),
  dueAt: dateStr,
});

export async function createHomework(scope: OrgScope, raw: unknown): Promise<HomeworkDetailDto> {
  const input = parseInput(createHomeworkSchema, raw);

  const staff = await getCurrentStaffProfile(scope);
  if (!staff || !staff.isTeaching) throw new HttpError("TEACHER_NOT_ASSIGNED", "Homework can only be created by a real, active teaching Staff member");

  const section = await prisma.section.findFirst({ where: { id: input.sectionId, schoolId: scope.schoolId, academicSessionId: requireSession(scope), ...(scope.branchId ? { branchId: scope.branchId } : {}) }, select: { id: true, classId: true, branchId: true } });
  if (!section) throw new HttpError("NOT_FOUND", "Section not found");

  const subjectOffered = await prisma.classSubject.findFirst({ where: { classId: section.classId, subjectId: input.subjectId }, select: { id: true } });
  if (!subjectOffered) throw new HttpError("SUBJECT_NOT_OFFERED", "This subject is not offered to this section's class");

  const teachingAssignment = await prisma.teachingAssignment.findFirst({ where: { sectionId: input.sectionId, subjectId: input.subjectId, staffId: staff.id }, select: { id: true } });
  if (!teachingAssignment) throw new HttpError("TEACHER_NOT_ASSIGNED", "You are not assigned to teach this subject in this section");

  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.homework.create({
      data: {
        tenantId: scope.tenantId, schoolId: scope.schoolId, branchId: section.branchId, academicSessionId: requireSession(scope),
        sectionId: input.sectionId, subjectId: input.subjectId, staffId: staff.id, teachingAssignmentId: teachingAssignment.id,
        title: input.title, description: input.description, instructions: input.instructions ?? null,
        dueAt: new Date(`${input.dueAt}T00:00:00.000Z`), status: "DRAFT",
        createdByUserId: scope.actor.id, createdByName: scope.actor.name,
      },
      select: { id: true },
    });
    await recordAudit(tx, scope, "HOMEWORK_CREATED", "Homework", row.id, { sectionId: input.sectionId, subjectId: input.subjectId, staffId: staff.id });
    return row;
  });
  return getHomework(scope, created.id);
}

// ── Update (never structural — no section/subject/staff fields exist here) ──

export const updateHomeworkSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().min(1).max(4000).optional(),
  instructions: z.string().trim().max(4000).nullable().optional(),
  dueAt: dateStr.optional(),
});

async function assertCanManage(scope: OrgScope, staffId: string): Promise<void> {
  if (await isBroadHomeworkManager(scope)) return;
  const staff = await getCurrentStaffProfile(scope);
  if (!staff || staff.id !== staffId) throw new HttpError("FORBIDDEN", "You do not have permission to perform this action.");
}

export async function updateHomework(scope: OrgScope, homeworkId: string, raw: unknown): Promise<HomeworkDetailDto> {
  const input = parseInput(updateHomeworkSchema, raw);
  const existing = await requireHomeworkInScope(scope, homeworkId);
  await assertCanManage(scope, existing.staff.id);

  await prisma.$transaction(async (tx) => {
    await tx.homework.update({
      where: { id: homeworkId },
      data: {
        title: input.title, description: input.description,
        instructions: input.instructions === undefined ? undefined : input.instructions,
        dueAt: input.dueAt ? new Date(`${input.dueAt}T00:00:00.000Z`) : undefined,
      },
    });
    await recordAudit(tx, scope, "HOMEWORK_UPDATED", "Homework", homeworkId, {});
  });
  return getHomework(scope, homeworkId);
}

// ── Lifecycle ────────────────────────────────────────────────────────────

export async function publishHomework(scope: OrgScope, homeworkId: string): Promise<HomeworkDetailDto> {
  const existing = await requireHomeworkInScope(scope, homeworkId);
  await assertCanManage(scope, existing.staff.id);
  if (existing.status !== "DRAFT") throw new HttpError("HOMEWORK_ALREADY_PUBLISHED", "Only draft homework can be published");

  await prisma.$transaction(async (tx) => {
    // Atomic guarded transition — the where clause re-checks status=DRAFT at
    // write time, so two concurrent publish calls can't both succeed (the
    // earlier existing.status check above is only a fast-path UX check).
    const { count } = await tx.homework.updateMany({ where: { id: homeworkId, status: "DRAFT" }, data: { status: "PUBLISHED" } });
    if (count === 0) throw new HttpError("HOMEWORK_ALREADY_PUBLISHED", "Only draft homework can be published");
    await recordAudit(tx, scope, "HOMEWORK_PUBLISHED", "Homework", homeworkId, {});
  });
  return getHomework(scope, homeworkId);
}

export async function closeHomework(scope: OrgScope, homeworkId: string): Promise<HomeworkDetailDto> {
  const existing = await requireHomeworkInScope(scope, homeworkId);
  await assertCanManage(scope, existing.staff.id);
  if (existing.status !== "PUBLISHED") throw new HttpError("CONFLICT", "Only published homework can be closed");

  await prisma.$transaction(async (tx) => {
    // Atomic guarded transition — see publishHomework's note on the race.
    const { count } = await tx.homework.updateMany({ where: { id: homeworkId, status: "PUBLISHED" }, data: { status: "CLOSED" } });
    if (count === 0) throw new HttpError("CONFLICT", "Only published homework can be closed");
    await recordAudit(tx, scope, "HOMEWORK_CLOSED", "Homework", homeworkId, {});
  });
  return getHomework(scope, homeworkId);
}

// ── My Day summary (shared with lib/server/my-day/service.ts) ──────────────

export async function getMyDayHomeworkSummary(scope: OrgScope, staffId: string, today: string): Promise<{ draftCount: number; dueTodayOrOverdueCount: number; items: HomeworkListItemDto[] }> {
  const sessionId = requireSession(scope);
  const todayDate = new Date(`${today}T00:00:00.000Z`);
  const [draftCount, dueTodayOrOverdueCount, rows] = await Promise.all([
    prisma.homework.count({ where: { schoolId: scope.schoolId, academicSessionId: sessionId, staffId, status: "DRAFT" } }),
    prisma.homework.count({ where: { schoolId: scope.schoolId, academicSessionId: sessionId, staffId, status: "PUBLISHED", dueAt: { lte: todayDate } } }),
    prisma.homework.findMany({ where: { schoolId: scope.schoolId, academicSessionId: sessionId, staffId, status: "PUBLISHED" }, orderBy: [{ dueAt: "asc" }], take: 5, select: listSelect }),
  ]);
  const counts = await enrolledCounts([...new Set(rows.map((r) => r.section.id))]);
  return { draftCount, dueTodayOrOverdueCount, items: rows.map((r) => listItemDto(r, counts.get(r.section.id) ?? 0)) };
}

// ── Duplicate (preserves the existing UI's "Duplicate" action — a plain
// create of a new DRAFT copy, same section/subject/staff/title/content) ────

export async function duplicateHomework(scope: OrgScope, homeworkId: string): Promise<HomeworkDetailDto> {
  const existing = await requireHomeworkInScope(scope, homeworkId);
  await assertCanManage(scope, existing.staff.id);

  // Preserve the ORIGINAL section/subject/staff/TeachingAssignment — never
  // re-derived from the duplicating actor. A broad manager (admin/principal)
  // duplicating another teacher's homework must not reassign authorship to
  // themselves (and would otherwise be rejected by createHomework's own-
  // TeachingAssignment check if they aren't a teacher on that section/subject
  // themselves). The TeachingAssignment FK is Restrict, so it is guaranteed
  // to still exist as long as `existing` does.
  const original = await prisma.homework.findUniqueOrThrow({ where: { id: homeworkId }, select: { sectionId: true, subjectId: true, staffId: true, teachingAssignmentId: true, branchId: true } });

  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.homework.create({
      data: {
        tenantId: scope.tenantId, schoolId: scope.schoolId, branchId: original.branchId, academicSessionId: requireSession(scope),
        sectionId: original.sectionId, subjectId: original.subjectId, staffId: original.staffId, teachingAssignmentId: original.teachingAssignmentId,
        title: `${existing.title} (copy)`, description: existing.description, instructions: existing.instructions ?? null,
        dueAt: existing.dueAt, status: "DRAFT",
        createdByUserId: scope.actor.id, createdByName: scope.actor.name,
      },
      select: { id: true },
    });
    await recordAudit(tx, scope, "HOMEWORK_CREATED", "Homework", row.id, { sectionId: original.sectionId, subjectId: original.subjectId, staffId: original.staffId, duplicatedFrom: homeworkId });
    return row;
  });
  return getHomework(scope, created.id);
}
