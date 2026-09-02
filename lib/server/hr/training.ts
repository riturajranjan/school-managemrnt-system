// Production migration (Phase B, HR Sub-batch 3) — Training. Real Staff.id
// relationship via a relational TrainingParticipant join row (never an array
// of staff ids on the program). No score/result field — no genuine
// assessment engine exists yet; certificateIssued is a simple recorded fact.
import { Prisma } from "@/lib/generated/prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import type { ListMeta } from "@/lib/server/api/response";
import { parseInput } from "@/lib/server/validation";
import type { OrgScope } from "@/lib/server/api/scope";
import type {
  MyTrainingAssignmentDto,
  TrainingParticipantDto,
  TrainingParticipantStatusDto,
  TrainingProgramDto,
  TrainingProgramStatusDto,
  TrainingProgramSummaryDto,
} from "@/lib/api/contracts";

const PROGRAM_STATUS_TO_DTO: Record<string, TrainingProgramStatusDto> = {
  DRAFT: "draft", SCHEDULED: "scheduled", IN_PROGRESS: "in-progress", COMPLETED: "completed", CANCELLED: "cancelled", ARCHIVED: "archived",
};
const DTO_TO_PROGRAM_STATUS = Object.fromEntries(Object.entries(PROGRAM_STATUS_TO_DTO).map(([k, v]) => [v, k])) as Record<TrainingProgramStatusDto, string>;
const PROGRAM_STATUS_VALUES = Object.keys(DTO_TO_PROGRAM_STATUS) as [TrainingProgramStatusDto, ...TrainingProgramStatusDto[]];

/** "archived" is the delete-equivalent — a program is never hard-deleted. */
export const TRAINING_PROGRAM_NEXT_STATUS: Record<TrainingProgramStatusDto, TrainingProgramStatusDto[]> = {
  draft: ["scheduled", "cancelled", "archived"],
  scheduled: ["in-progress", "cancelled", "archived"],
  "in-progress": ["completed", "cancelled", "archived"],
  completed: ["archived"],
  cancelled: ["archived"],
  archived: [],
};

const PARTICIPANT_STATUS_TO_DTO: Record<string, TrainingParticipantStatusDto> = {
  ASSIGNED: "assigned", IN_PROGRESS: "in-progress", COMPLETED: "completed", CANCELLED: "cancelled",
};
const DTO_TO_PARTICIPANT_STATUS = Object.fromEntries(Object.entries(PARTICIPANT_STATUS_TO_DTO).map(([k, v]) => [v, k])) as Record<TrainingParticipantStatusDto, string>;

export const TRAINING_PARTICIPANT_NEXT_STATUS: Record<TrainingParticipantStatusDto, TrainingParticipantStatusDto[]> = {
  assigned: ["in-progress", "completed", "cancelled"],
  "in-progress": ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

type ProgramRow = {
  id: string; title: string; description: string | null; category: string | null; trainerName: string | null;
  startDate: Date; endDate: Date | null; status: string; createdByName: string | null; updatedByName: string | null;
  createdAt: Date; updatedAt: Date; _count: { participants: number };
};

const programSelect = {
  id: true, title: true, description: true, category: true, trainerName: true, startDate: true, endDate: true, status: true,
  createdByName: true, updatedByName: true, createdAt: true, updatedAt: true, _count: { select: { participants: true } },
} satisfies Prisma.TrainingProgramSelect;

function toDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function programDto(row: ProgramRow): TrainingProgramDto {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    trainerName: row.trainerName,
    startDate: toDate(row.startDate),
    endDate: row.endDate ? toDate(row.endDate) : null,
    status: (PROGRAM_STATUS_TO_DTO[row.status] ?? "draft") as TrainingProgramStatusDto,
    participantCount: row._count.participants,
    createdByName: row.createdByName,
    updatedByName: row.updatedByName,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function requireProgramRow(scope: OrgScope, programId: string): Promise<ProgramRow> {
  const row = await prisma.trainingProgram.findFirst({
    where: { id: programId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) },
    select: programSelect,
  });
  if (!row) throw new HttpError("TRAINING_PROGRAM_NOT_FOUND", "Training program not found");
  return row;
}

export const listTrainingProgramsSchema = z.object({
  status: z.enum(PROGRAM_STATUS_VALUES).optional(),
  category: z.string().trim().max(80).optional(),
  search: z.string().trim().max(200).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});

export async function listTrainingPrograms(scope: OrgScope, raw: unknown = {}): Promise<{ data: TrainingProgramDto[]; meta: ListMeta }> {
  const input = parseInput(listTrainingProgramsSchema, raw);
  const where: Prisma.TrainingProgramWhereInput = { schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) };
  if (input.status) where.status = DTO_TO_PROGRAM_STATUS[input.status] as never;
  if (input.category) where.category = { equals: input.category, mode: "insensitive" };
  if (input.search) {
    const q = input.search;
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { category: { contains: q, mode: "insensitive" } },
      { trainerName: { contains: q, mode: "insensitive" } },
    ];
  }
  const [total, rows] = await Promise.all([
    prisma.trainingProgram.count({ where }),
    prisma.trainingProgram.findMany({ where, select: programSelect, orderBy: { startDate: "desc" }, skip: (input.page - 1) * input.pageSize, take: input.pageSize }),
  ]);
  return { data: rows.map(programDto), meta: { page: input.page, pageSize: input.pageSize, total, totalPages: Math.max(1, Math.ceil(total / input.pageSize)) } };
}

/** Whole-scope status aggregates — ignores the list's own search/status
 * filter and page so summary tiles never regress to counting only the
 * current page. */
export async function getTrainingProgramSummary(scope: OrgScope): Promise<TrainingProgramSummaryDto> {
  const where: Prisma.TrainingProgramWhereInput = { schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) };
  const grouped = await prisma.trainingProgram.groupBy({ by: ["status"], where, _count: { _all: true } });
  const counts = Object.fromEntries(grouped.map((g) => [g.status, g._count._all]));
  const draft = counts.DRAFT ?? 0, scheduled = counts.SCHEDULED ?? 0, inProgress = counts.IN_PROGRESS ?? 0;
  const completed = counts.COMPLETED ?? 0, cancelled = counts.CANCELLED ?? 0, archived = counts.ARCHIVED ?? 0;
  return { total: draft + scheduled + inProgress + completed + cancelled + archived, draft, scheduled, inProgress, completed, cancelled, archived };
}

export async function getTrainingProgram(scope: OrgScope, programId: string): Promise<TrainingProgramDto> {
  return programDto(await requireProgramRow(scope, programId));
}

async function resolveBranch(scope: OrgScope): Promise<string> {
  if (scope.branchId) return scope.branchId;
  const active = await prisma.branch.findMany({ where: { schoolId: scope.schoolId, status: "ACTIVE" }, select: { id: true } });
  if (active.length === 1) return active[0].id;
  throw new HttpError("INVALID_BRANCH", "Select a branch for this training program");
}

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export const createTrainingProgramSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    description: z.string().trim().max(2000).optional(),
    category: z.string().trim().max(80).optional(),
    trainerName: z.string().trim().max(120).optional(),
    startDate: dateSchema,
    endDate: dateSchema.optional(),
  })
  .refine((v) => !v.endDate || v.endDate >= v.startDate, { message: "End date must be on or after the start date", path: ["endDate"] });

export async function createTrainingProgram(scope: OrgScope, raw: unknown): Promise<TrainingProgramDto> {
  const input = parseInput(createTrainingProgramSchema, raw);
  const branchId = await resolveBranch(scope);
  const row = await prisma.trainingProgram.create({
    data: {
      tenantId: scope.tenantId, schoolId: scope.schoolId, branchId,
      title: input.title, description: input.description, category: input.category, trainerName: input.trainerName,
      startDate: new Date(`${input.startDate}T00:00:00Z`), endDate: input.endDate ? new Date(`${input.endDate}T00:00:00Z`) : null,
      createdByUserId: scope.actor.id, createdByName: scope.actor.name,
    },
    select: programSelect,
  });
  await recordAudit(prisma, scope, "TRAINING_PROGRAM_CREATED", "TrainingProgram", row.id, { title: row.title });
  return programDto(row);
}

export const updateTrainingProgramSchema = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    category: z.string().trim().max(80).nullable().optional(),
    trainerName: z.string().trim().max(120).nullable().optional(),
    startDate: dateSchema.optional(),
    endDate: dateSchema.nullable().optional(),
  })
  .refine((v) => !v.startDate || !v.endDate || v.endDate >= v.startDate, { message: "End date must be on or after the start date", path: ["endDate"] });

export async function updateTrainingProgram(scope: OrgScope, programId: string, raw: unknown): Promise<TrainingProgramDto> {
  const input = parseInput(updateTrainingProgramSchema, raw);
  await requireProgramRow(scope, programId);
  const row = await prisma.trainingProgram.update({
    where: { id: programId },
    data: {
      title: input.title, description: input.description, category: input.category, trainerName: input.trainerName,
      startDate: input.startDate ? new Date(`${input.startDate}T00:00:00Z`) : undefined,
      endDate: input.endDate === undefined ? undefined : input.endDate ? new Date(`${input.endDate}T00:00:00Z`) : null,
      updatedByUserId: scope.actor.id, updatedByName: scope.actor.name,
    },
    select: programSelect,
  });
  await recordAudit(prisma, scope, "TRAINING_PROGRAM_UPDATED", "TrainingProgram", programId, input);
  return programDto(row);
}

export async function setTrainingProgramStatus(scope: OrgScope, programId: string, status: TrainingProgramStatusDto): Promise<TrainingProgramDto> {
  const existing = await requireProgramRow(scope, programId);
  const current = (PROGRAM_STATUS_TO_DTO[existing.status] ?? "draft") as TrainingProgramStatusDto;
  if (!TRAINING_PROGRAM_NEXT_STATUS[current].includes(status)) {
    throw new HttpError("INVALID_STATUS_TRANSITION", `Cannot move a training program from "${current}" to "${status}"`);
  }
  const row = await prisma.trainingProgram.update({
    where: { id: programId },
    data: { status: DTO_TO_PROGRAM_STATUS[status] as never, updatedByUserId: scope.actor.id, updatedByName: scope.actor.name },
    select: programSelect,
  });
  await recordAudit(prisma, scope, "TRAINING_PROGRAM_STATUS_CHANGED", "TrainingProgram", programId, { status });
  return programDto(row);
}

// ── Participants ─────────────────────────────────────────────────────────

type ParticipantRow = {
  id: string; trainingProgramId: string; staffId: string; status: string; completedAt: Date | null; certificateIssued: boolean;
  assignedByName: string | null; assignedAt: Date;
  staff: { employeeCode: string; firstName: string; lastName: string | null; displayName: string | null };
};

const participantSelect = {
  id: true, trainingProgramId: true, staffId: true, status: true, completedAt: true, certificateIssued: true,
  assignedByName: true, assignedAt: true,
  staff: { select: { employeeCode: true, firstName: true, lastName: true, displayName: true } },
} satisfies Prisma.TrainingParticipantSelect;

function staffName(s: { firstName: string; lastName: string | null; displayName: string | null }): string {
  return s.displayName?.trim() || `${s.firstName} ${s.lastName ?? ""}`.trim();
}

function participantDto(row: ParticipantRow): TrainingParticipantDto {
  return {
    id: row.id,
    trainingProgramId: row.trainingProgramId,
    staffId: row.staffId,
    staffName: staffName(row.staff),
    employeeCode: row.staff.employeeCode,
    status: (PARTICIPANT_STATUS_TO_DTO[row.status] ?? "assigned") as TrainingParticipantStatusDto,
    completedAt: row.completedAt ? toDate(row.completedAt) : null,
    certificateIssued: row.certificateIssued,
    assignedByName: row.assignedByName,
    assignedAt: row.assignedAt.toISOString(),
  };
}

export async function listTrainingParticipants(scope: OrgScope, programId: string): Promise<TrainingParticipantDto[]> {
  await requireProgramRow(scope, programId);
  const rows = await prisma.trainingParticipant.findMany({ where: { trainingProgramId: programId }, select: participantSelect, orderBy: { assignedAt: "asc" } });
  return rows.map(participantDto);
}

async function requireParticipantRow(scope: OrgScope, participantId: string): Promise<ParticipantRow> {
  const row = await prisma.trainingParticipant.findFirst({
    where: { id: participantId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) },
    select: participantSelect,
  });
  if (!row) throw new HttpError("TRAINING_PARTICIPANT_NOT_FOUND", "Training participant not found");
  return row;
}

export const assignTrainingParticipantSchema = z.object({ staffId: z.string().min(1) });

export async function assignTrainingParticipant(scope: OrgScope, programId: string, raw: unknown): Promise<TrainingParticipantDto> {
  const input = parseInput(assignTrainingParticipantSchema, raw);
  const program = await requireProgramRow(scope, programId);
  const staff = await prisma.staff.findFirst({
    where: { id: input.staffId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) },
    select: { id: true, branchId: true },
  });
  if (!staff) throw new HttpError("VALIDATION_ERROR", "Staff member not found in this school");
  let row;
  try {
    row = await prisma.trainingParticipant.create({
      data: {
        tenantId: scope.tenantId, schoolId: scope.schoolId, branchId: staff.branchId,
        trainingProgramId: program.id, staffId: staff.id,
        assignedByUserId: scope.actor.id, assignedByName: scope.actor.name,
      },
      select: participantSelect,
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new HttpError("TRAINING_PARTICIPANT_EXISTS", "This employee is already assigned to this training program");
    }
    throw e;
  }
  await recordAudit(prisma, scope, "TRAINING_PARTICIPANT_ASSIGNED", "TrainingParticipant", row.id, { trainingProgramId: program.id, staffId: staff.id });
  return participantDto(row);
}

export const updateTrainingParticipantStatusSchema = z.object({
  status: z.enum(["in-progress", "completed", "cancelled"] as const),
  completedAt: dateSchema.optional(),
  certificateIssued: z.boolean().optional(),
});

export async function setTrainingParticipantStatus(scope: OrgScope, participantId: string, raw: unknown): Promise<TrainingParticipantDto> {
  const input = parseInput(updateTrainingParticipantStatusSchema, raw);
  const existing = await requireParticipantRow(scope, participantId);
  const current = (PARTICIPANT_STATUS_TO_DTO[existing.status] ?? "assigned") as TrainingParticipantStatusDto;
  if (!TRAINING_PARTICIPANT_NEXT_STATUS[current].includes(input.status)) {
    throw new HttpError("INVALID_STATUS_TRANSITION", `Cannot move a training participant from "${current}" to "${input.status}"`);
  }
  const row = await prisma.trainingParticipant.update({
    where: { id: participantId },
    data: {
      status: DTO_TO_PARTICIPANT_STATUS[input.status] as never,
      completedAt: input.status === "completed" ? new Date(`${input.completedAt ?? new Date().toISOString().slice(0, 10)}T00:00:00Z`) : undefined,
      certificateIssued: input.certificateIssued,
    },
    select: participantSelect,
  });
  await recordAudit(prisma, scope, "TRAINING_PARTICIPANT_STATUS_CHANGED", "TrainingParticipant", participantId, { status: input.status });
  return participantDto(row);
}

/** Own-record reads (Employee Self Service) — read-only, the caller's own
 * assignments only. hr.viewOwn never lets a caller create/assign/complete
 * anything here (no mutation entry point takes this identity path). */
export async function listMyTrainingAssignments(scope: OrgScope, staffId: string): Promise<MyTrainingAssignmentDto[]> {
  const rows = await prisma.trainingParticipant.findMany({
    where: { schoolId: scope.schoolId, staffId },
    select: {
      id: true, trainingProgramId: true, status: true, completedAt: true, certificateIssued: true,
      program: { select: { title: true, category: true, startDate: true, endDate: true, status: true } },
    },
    orderBy: { assignedAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    trainingProgramId: r.trainingProgramId,
    title: r.program.title,
    category: r.program.category,
    startDate: toDate(r.program.startDate),
    endDate: r.program.endDate ? toDate(r.program.endDate) : null,
    programStatus: (PROGRAM_STATUS_TO_DTO[r.program.status] ?? "draft") as TrainingProgramStatusDto,
    status: (PARTICIPANT_STATUS_TO_DTO[r.status] ?? "assigned") as TrainingParticipantStatusDto,
    completedAt: r.completedAt ? toDate(r.completedAt) : null,
    certificateIssued: r.certificateIssued,
  }));
}

export { PROGRAM_STATUS_VALUES as TRAINING_PROGRAM_STATUS_VALUES };
