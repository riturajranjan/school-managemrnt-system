// Production migration (Phase B, HR Sub-batch 4) — Employee Onboarding. NOT
// SchoolOnboarding (platform-side, provisioning a new school) — this is a
// brand-new-employee's own checklist, always tied to a real Staff.id.
// Onboarding 1→many OnboardingTask, never boolean columns on the parent.
// Progress is always derived live from real task completion, never stored.
import { Prisma } from "@/lib/generated/prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import type { ListMeta } from "@/lib/server/api/response";
import { parseInput } from "@/lib/server/validation";
import type { OrgScope } from "@/lib/server/api/scope";
import type { EmployeeOnboardingDto, EmployeeOnboardingStatusDto, OnboardingTaskDto } from "@/lib/api/contracts";

const STATUS_TO_DTO: Record<string, EmployeeOnboardingStatusDto> = { NOT_STARTED: "not-started", IN_PROGRESS: "in-progress", COMPLETED: "completed", CANCELLED: "cancelled" };
const DTO_TO_STATUS = Object.fromEntries(Object.entries(STATUS_TO_DTO).map(([k, v]) => [v, k])) as Record<EmployeeOnboardingStatusDto, string>;
export const EMPLOYEE_ONBOARDING_STATUS_VALUES = Object.keys(DTO_TO_STATUS) as [EmployeeOnboardingStatusDto, ...EmployeeOnboardingStatusDto[]];

/** Manual HR override lifecycle — task completion also auto-advances
 * NOT_STARTED→IN_PROGRESS (first task done) and →COMPLETED (last task done),
 * see recomputeStatusFromTasks. Reopening a task never auto-reverts status. */
export const EMPLOYEE_ONBOARDING_NEXT_STATUS: Record<EmployeeOnboardingStatusDto, EmployeeOnboardingStatusDto[]> = {
  "not-started": ["in-progress", "cancelled"],
  "in-progress": ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

// The task's own suggested checklist — only tasks appropriate to this
// product, no dozens of boolean columns (one OnboardingTask row each).
const DEFAULT_TASK_TEMPLATE: { label: string; category: string }[] = [
  { label: "Personal details", category: "documents" },
  { label: "Identity documents", category: "documents" },
  { label: "Contract", category: "documents" },
  { label: "Department/designation", category: "access" },
  { label: "Policy acknowledgement", category: "compliance" },
  { label: "System/account setup", category: "access" },
  { label: "Orientation", category: "orientation" },
  { label: "Training", category: "orientation" },
];

function toDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function staffName(s: { firstName: string; lastName: string | null; displayName: string | null }): string {
  return s.displayName?.trim() || `${s.firstName} ${s.lastName ?? ""}`.trim();
}

type TaskRow = {
  id: string; label: string; category: string | null; status: string; completedAt: Date | null; completedByName: string | null;
};

type OnboardingRow = {
  id: string; staffId: string; jobApplicantId: string | null; hrOwnerStaffId: string | null;
  startDate: Date; expectedCompletionDate: Date | null; status: string;
  createdByName: string | null; updatedByName: string | null; createdAt: Date; updatedAt: Date;
  staff: { employeeCode: string; firstName: string; lastName: string | null; displayName: string | null };
  hrOwner: { firstName: string; lastName: string | null; displayName: string | null } | null;
  tasks: TaskRow[];
};

const select = {
  id: true, staffId: true, jobApplicantId: true, hrOwnerStaffId: true, startDate: true, expectedCompletionDate: true, status: true,
  createdByName: true, updatedByName: true, createdAt: true, updatedAt: true,
  staff: { select: { employeeCode: true, firstName: true, lastName: true, displayName: true } },
  hrOwner: { select: { firstName: true, lastName: true, displayName: true } },
  tasks: { select: { id: true, label: true, category: true, status: true, completedAt: true, completedByName: true }, orderBy: { createdAt: "asc" } },
} satisfies Prisma.EmployeeOnboardingSelect;

function taskDto(t: TaskRow): OnboardingTaskDto {
  return {
    id: t.id, label: t.label, category: t.category,
    status: t.status === "COMPLETED" ? "completed" : "pending",
    completedAt: t.completedAt ? t.completedAt.toISOString() : null,
    completedByName: t.completedByName,
  };
}

function dto(row: OnboardingRow): EmployeeOnboardingDto {
  const total = row.tasks.length;
  const done = row.tasks.filter((t) => t.status === "COMPLETED").length;
  return {
    id: row.id,
    staffId: row.staffId,
    staffName: staffName(row.staff),
    employeeCode: row.staff.employeeCode,
    jobApplicantId: row.jobApplicantId,
    hrOwnerStaffId: row.hrOwnerStaffId,
    hrOwnerName: row.hrOwner ? staffName(row.hrOwner) : null,
    startDate: toDate(row.startDate),
    expectedCompletionDate: row.expectedCompletionDate ? toDate(row.expectedCompletionDate) : null,
    status: (STATUS_TO_DTO[row.status] ?? "not-started") as EmployeeOnboardingStatusDto,
    progressPercent: total === 0 ? 0 : Math.round((done / total) * 100),
    tasks: row.tasks.map(taskDto),
    createdByName: row.createdByName,
    updatedByName: row.updatedByName,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
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

async function validateHrOwner(scope: OrgScope, hrOwnerStaffId: string): Promise<void> {
  const row = await prisma.staff.findFirst({ where: { id: hrOwnerStaffId, schoolId: scope.schoolId, status: "ACTIVE" }, select: { id: true } });
  if (!row) throw new HttpError("VALIDATION_ERROR", "HR owner must be a real, active staff member in this school");
}

async function requireOnboardingRow(scope: OrgScope, onboardingId: string): Promise<OnboardingRow> {
  const row = await prisma.employeeOnboarding.findFirst({
    where: { id: onboardingId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) },
    select,
  });
  if (!row) throw new HttpError("EMPLOYEE_ONBOARDING_NOT_FOUND", "Onboarding record not found");
  return row;
}

export const listEmployeeOnboardingsSchema = z.object({
  status: z.enum(EMPLOYEE_ONBOARDING_STATUS_VALUES).optional(),
  search: z.string().trim().max(200).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});

/** Search matches the real Staff subject's own name/employee code — never a
 * free-text field that doesn't exist on the row. */
export async function listEmployeeOnboardings(scope: OrgScope, raw: unknown = {}): Promise<{ data: EmployeeOnboardingDto[]; meta: ListMeta }> {
  const input = parseInput(listEmployeeOnboardingsSchema, raw);
  const where: Prisma.EmployeeOnboardingWhereInput = { schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) };
  if (input.status) where.status = DTO_TO_STATUS[input.status] as never;
  if (input.search) {
    const q = input.search;
    where.staff = {
      OR: [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { displayName: { contains: q, mode: "insensitive" } },
        { employeeCode: { contains: q, mode: "insensitive" } },
      ],
    };
  }
  const [total, rows] = await Promise.all([
    prisma.employeeOnboarding.count({ where }),
    prisma.employeeOnboarding.findMany({ where, select, orderBy: { startDate: "desc" }, skip: (input.page - 1) * input.pageSize, take: input.pageSize }),
  ]);
  return { data: rows.map(dto), meta: { page: input.page, pageSize: input.pageSize, total, totalPages: Math.max(1, Math.ceil(total / input.pageSize)) } };
}

export async function getEmployeeOnboarding(scope: OrgScope, onboardingId: string): Promise<EmployeeOnboardingDto> {
  return dto(await requireOnboardingRow(scope, onboardingId));
}

/** Own-record read (Employee Self Service) — the caller's most recent
 * onboarding record, or null if they've never had one. */
export async function getMyOnboarding(scope: OrgScope, staffId: string): Promise<EmployeeOnboardingDto | null> {
  const row = await prisma.employeeOnboarding.findFirst({ where: { schoolId: scope.schoolId, staffId }, select, orderBy: { startDate: "desc" } });
  return row ? dto(row) : null;
}

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export const createEmployeeOnboardingSchema = z.object({
  staffId: z.string().min(1),
  startDate: dateSchema,
  expectedCompletionDate: dateSchema.optional(),
  hrOwnerStaffId: z.string().min(1).optional(),
});

/** Internal implementation shared by the direct-create route and
 * recruitment.ts's startOnboardingFromApplicant — the latter passes an
 * already-resolved jobApplicantId, never accepted from raw client input. */
export async function startEmployeeOnboarding(
  scope: OrgScope,
  input: { staffId: string; startDate: string; expectedCompletionDate?: string; hrOwnerStaffId?: string; jobApplicantId?: string },
): Promise<EmployeeOnboardingDto> {
  const staff = await requireStaffRow(scope, input.staffId);
  if (input.hrOwnerStaffId) await validateHrOwner(scope, input.hrOwnerStaffId);

  const active = await prisma.employeeOnboarding.findFirst({
    where: { staffId: staff.id, status: { in: ["NOT_STARTED", "IN_PROGRESS"] } },
    select: { id: true },
  });
  if (active) throw new HttpError("ONBOARDING_ALREADY_STARTED", "This staff member already has an active onboarding");

  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.employeeOnboarding.create({
      data: {
        tenantId: scope.tenantId, schoolId: scope.schoolId, branchId: staff.branchId,
        staffId: staff.id, jobApplicantId: input.jobApplicantId, hrOwnerStaffId: input.hrOwnerStaffId,
        startDate: new Date(`${input.startDate}T00:00:00Z`),
        expectedCompletionDate: input.expectedCompletionDate ? new Date(`${input.expectedCompletionDate}T00:00:00Z`) : null,
        createdByUserId: scope.actor.id, createdByName: scope.actor.name,
      },
      select: { id: true },
    });
    await tx.onboardingTask.createMany({
      data: DEFAULT_TASK_TEMPLATE.map((t) => ({
        tenantId: scope.tenantId, schoolId: scope.schoolId, branchId: staff.branchId,
        employeeOnboardingId: row.id, label: t.label, category: t.category,
      })),
    });
    await recordAudit(tx, scope, "EMPLOYEE_ONBOARDING_STARTED", "EmployeeOnboarding", row.id, { staffId: staff.id });
    return row;
  });

  return dto(await prisma.employeeOnboarding.findUniqueOrThrow({ where: { id: created.id }, select }));
}

export async function createEmployeeOnboarding(scope: OrgScope, raw: unknown): Promise<EmployeeOnboardingDto> {
  const input = parseInput(createEmployeeOnboardingSchema, raw);
  return startEmployeeOnboarding(scope, input);
}

export const updateEmployeeOnboardingSchema = z.object({
  expectedCompletionDate: dateSchema.nullable().optional(),
  hrOwnerStaffId: z.string().min(1).nullable().optional(),
});

export async function updateEmployeeOnboarding(scope: OrgScope, onboardingId: string, raw: unknown): Promise<EmployeeOnboardingDto> {
  const input = parseInput(updateEmployeeOnboardingSchema, raw);
  await requireOnboardingRow(scope, onboardingId);
  if (input.hrOwnerStaffId) await validateHrOwner(scope, input.hrOwnerStaffId);
  const row = await prisma.employeeOnboarding.update({
    where: { id: onboardingId },
    data: {
      expectedCompletionDate: input.expectedCompletionDate === undefined ? undefined : input.expectedCompletionDate ? new Date(`${input.expectedCompletionDate}T00:00:00Z`) : null,
      hrOwnerStaffId: input.hrOwnerStaffId,
      updatedByUserId: scope.actor.id, updatedByName: scope.actor.name,
    },
    select,
  });
  await recordAudit(prisma, scope, "EMPLOYEE_ONBOARDING_UPDATED", "EmployeeOnboarding", onboardingId, input);
  return dto(row);
}

export async function setEmployeeOnboardingStatus(scope: OrgScope, onboardingId: string, status: EmployeeOnboardingStatusDto): Promise<EmployeeOnboardingDto> {
  const existing = await requireOnboardingRow(scope, onboardingId);
  const currentStatus = (STATUS_TO_DTO[existing.status] ?? "not-started") as EmployeeOnboardingStatusDto;
  if (!EMPLOYEE_ONBOARDING_NEXT_STATUS[currentStatus].includes(status)) {
    throw new HttpError("VALIDATION_ERROR", `Cannot move onboarding from "${currentStatus}" to "${status}"`);
  }
  const row = await prisma.employeeOnboarding.update({
    where: { id: onboardingId },
    data: { status: DTO_TO_STATUS[status] as never, updatedByUserId: scope.actor.id, updatedByName: scope.actor.name },
    select,
  });
  await recordAudit(prisma, scope, "EMPLOYEE_ONBOARDING_STATUS_CHANGED", "EmployeeOnboarding", onboardingId, { status });
  return dto(row);
}

// ── Tasks ────────────────────────────────────────────────────────────────

async function requireTaskRow(scope: OrgScope, taskId: string): Promise<{ id: string; employeeOnboardingId: string; status: string }> {
  const row = await prisma.onboardingTask.findFirst({
    where: { id: taskId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) },
    select: { id: true, employeeOnboardingId: true, status: true },
  });
  if (!row) throw new HttpError("ONBOARDING_TASK_NOT_FOUND", "Onboarding task not found");
  return row;
}

/** Auto-advances the parent onboarding's status from real task completion —
 * NOT_STARTED→IN_PROGRESS on the first completed task, →COMPLETED once every
 * task is done. Never auto-reverts a manually-set COMPLETED/CANCELLED
 * status, and reopening a task never un-completes the onboarding record. */
async function recomputeStatusFromTasks(tx: Prisma.TransactionClient, scope: OrgScope, onboardingId: string): Promise<void> {
  const [onboarding, tasks] = await Promise.all([
    tx.employeeOnboarding.findUniqueOrThrow({ where: { id: onboardingId }, select: { status: true } }),
    tx.onboardingTask.findMany({ where: { employeeOnboardingId: onboardingId }, select: { status: true } }),
  ]);
  if (onboarding.status !== "NOT_STARTED" && onboarding.status !== "IN_PROGRESS") return;
  const allDone = tasks.length > 0 && tasks.every((t) => t.status === "COMPLETED");
  const nextStatus = allDone ? "COMPLETED" : "IN_PROGRESS";
  if (nextStatus !== onboarding.status) {
    await tx.employeeOnboarding.update({
      where: { id: onboardingId },
      data: { status: nextStatus, updatedByUserId: scope.actor.id, updatedByName: scope.actor.name },
    });
    await recordAudit(tx, scope, "EMPLOYEE_ONBOARDING_STATUS_CHANGED", "EmployeeOnboarding", onboardingId, { status: nextStatus === "COMPLETED" ? "completed" : "in-progress", auto: true });
  }
}

export async function completeOnboardingTask(scope: OrgScope, taskId: string): Promise<EmployeeOnboardingDto> {
  const task = await requireTaskRow(scope, taskId);
  await prisma.$transaction(async (tx) => {
    await tx.onboardingTask.update({
      where: { id: taskId },
      data: { status: "COMPLETED", completedAt: new Date(), completedByUserId: scope.actor.id, completedByName: scope.actor.name },
    });
    await recordAudit(tx, scope, "ONBOARDING_TASK_COMPLETED", "OnboardingTask", taskId, { onboardingId: task.employeeOnboardingId });
    await recomputeStatusFromTasks(tx, scope, task.employeeOnboardingId);
  });
  return dto(await prisma.employeeOnboarding.findUniqueOrThrow({ where: { id: task.employeeOnboardingId }, select }));
}

export async function reopenOnboardingTask(scope: OrgScope, taskId: string): Promise<EmployeeOnboardingDto> {
  const task = await requireTaskRow(scope, taskId);
  await prisma.onboardingTask.update({
    where: { id: taskId },
    data: { status: "PENDING", completedAt: null, completedByUserId: null, completedByName: null },
  });
  await recordAudit(prisma, scope, "ONBOARDING_TASK_REOPENED", "OnboardingTask", taskId, { onboardingId: task.employeeOnboardingId });
  return dto(await prisma.employeeOnboarding.findUniqueOrThrow({ where: { id: task.employeeOnboardingId }, select }));
}
