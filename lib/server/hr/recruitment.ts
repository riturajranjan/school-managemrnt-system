// Production migration (Phase B, HR Sub-batch 4) — Recruitment. Deliberately
// simple: Job Opening + Applicant only, no Interview/scoring/ATS pipeline
// engine (those stay mock: app/hr/recruitment/interviews, /candidates).
//
// A SELECTED applicant is NEVER auto-converted into a Staff/User. Only the
// explicit startOnboarding() action — invoked from a real "Start Onboarding"
// button, never a side effect of a stage change — provisions a Staff record,
// and it does so by calling the EXISTING createStaff service
// (lib/server/staff/service.ts), never a second employee-creation system.
// User/login provisioning is a separate, already-real, deliberately NOT
// bundled here (see the Hierarchical Account Provisioning admin flow).
import { Prisma } from "@/lib/generated/prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { createStaff } from "@/lib/server/staff/service";
import type { OrgScope } from "@/lib/server/api/scope";
import type {
  EmployeeOnboardingDto,
  EmploymentType,
  JobApplicantDto,
  JobApplicantStageDto,
  JobOpeningDto,
  JobOpeningStatusDto,
} from "@/lib/api/contracts";
import { startEmployeeOnboarding } from "./onboarding";

const EMP_TO_DB: Record<EmploymentType, string> = { "full-time": "FULL_TIME", "part-time": "PART_TIME", contract: "CONTRACT", temporary: "TEMPORARY" };
const DB_TO_EMP = Object.fromEntries(Object.entries(EMP_TO_DB).map(([k, v]) => [v, k])) as Record<string, EmploymentType>;
const EMP_VALUES = Object.keys(EMP_TO_DB) as [EmploymentType, ...EmploymentType[]];

const OPENING_STATUS_TO_DTO: Record<string, JobOpeningStatusDto> = { DRAFT: "draft", OPEN: "open", CLOSED: "closed", ARCHIVED: "archived" };
const DTO_TO_OPENING_STATUS = Object.fromEntries(Object.entries(OPENING_STATUS_TO_DTO).map(([k, v]) => [v, k])) as Record<JobOpeningStatusDto, string>;
export const JOB_OPENING_STATUS_VALUES = Object.keys(DTO_TO_OPENING_STATUS) as [JobOpeningStatusDto, ...JobOpeningStatusDto[]];

export const JOB_OPENING_NEXT_STATUS: Record<JobOpeningStatusDto, JobOpeningStatusDto[]> = {
  draft: ["open", "archived"],
  open: ["closed", "archived"],
  closed: ["archived"],
  archived: [],
};

const STAGE_TO_DTO: Record<string, JobApplicantStageDto> = {
  APPLIED: "applied", SCREENING: "screening", INTERVIEW: "interview", SELECTED: "selected", HIRED: "hired", REJECTED: "rejected", WITHDRAWN: "withdrawn",
};
const DTO_TO_STAGE = Object.fromEntries(Object.entries(STAGE_TO_DTO).map(([k, v]) => [v, k])) as Record<JobApplicantStageDto, string>;
export const JOB_APPLICANT_STAGE_VALUES = Object.keys(DTO_TO_STAGE) as [JobApplicantStageDto, ...JobApplicantStageDto[]];

export const JOB_APPLICANT_NEXT_STAGE: Record<JobApplicantStageDto, JobApplicantStageDto[]> = {
  applied: ["screening", "rejected", "withdrawn"],
  screening: ["interview", "rejected", "withdrawn"],
  interview: ["selected", "rejected", "withdrawn"],
  selected: ["hired", "rejected", "withdrawn"],
  hired: [],
  rejected: [],
  withdrawn: [],
};

function toDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ── Job Openings ─────────────────────────────────────────────────────────

type OpeningRow = {
  id: string; title: string; departmentId: string | null; designationId: string | null; employmentType: string | null;
  openings: number; description: string | null; requirements: string | null; publishDate: Date | null; closingDate: Date | null;
  status: string; createdByName: string | null; updatedByName: string | null; createdAt: Date; updatedAt: Date;
  department: { name: string } | null; designation: { name: string } | null; _count: { applicants: number };
};

const openingSelect = {
  id: true, title: true, departmentId: true, designationId: true, employmentType: true, openings: true, description: true,
  requirements: true, publishDate: true, closingDate: true, status: true, createdByName: true, updatedByName: true, createdAt: true, updatedAt: true,
  department: { select: { name: true } }, designation: { select: { name: true } }, _count: { select: { applicants: true } },
} satisfies Prisma.JobOpeningSelect;

function openingDto(row: OpeningRow): JobOpeningDto {
  return {
    id: row.id,
    title: row.title,
    departmentId: row.departmentId,
    departmentName: row.department?.name ?? null,
    designationId: row.designationId,
    designationName: row.designation?.name ?? null,
    employmentType: row.employmentType ? (DB_TO_EMP[row.employmentType] ?? null) : null,
    openings: row.openings,
    description: row.description,
    requirements: row.requirements,
    publishDate: row.publishDate ? toDate(row.publishDate) : null,
    closingDate: row.closingDate ? toDate(row.closingDate) : null,
    status: (OPENING_STATUS_TO_DTO[row.status] ?? "draft") as JobOpeningStatusDto,
    applicantCount: row._count.applicants,
    createdByName: row.createdByName,
    updatedByName: row.updatedByName,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function requireOpeningRow(scope: OrgScope, openingId: string): Promise<OpeningRow> {
  const row = await prisma.jobOpening.findFirst({
    where: { id: openingId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) },
    select: openingSelect,
  });
  if (!row) throw new HttpError("JOB_OPENING_NOT_FOUND", "Job opening not found");
  return row;
}

export async function listJobOpenings(scope: OrgScope, params: { status?: JobOpeningStatusDto } = {}): Promise<JobOpeningDto[]> {
  const where: Prisma.JobOpeningWhereInput = { schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) };
  if (params.status) where.status = DTO_TO_OPENING_STATUS[params.status] as never;
  const rows = await prisma.jobOpening.findMany({ where, select: openingSelect, orderBy: { createdAt: "desc" } });
  return rows.map(openingDto);
}

export async function getJobOpening(scope: OrgScope, openingId: string): Promise<JobOpeningDto> {
  return openingDto(await requireOpeningRow(scope, openingId));
}

async function resolveBranch(scope: OrgScope): Promise<string> {
  if (scope.branchId) return scope.branchId;
  const active = await prisma.branch.findMany({ where: { schoolId: scope.schoolId, status: "ACTIVE" }, select: { id: true } });
  if (active.length === 1) return active[0].id;
  throw new HttpError("INVALID_BRANCH", "Select a branch for this job opening");
}

async function validateDepartment(scope: OrgScope, departmentId: string): Promise<void> {
  const row = await prisma.department.findFirst({ where: { id: departmentId, schoolId: scope.schoolId }, select: { id: true } });
  if (!row) throw new HttpError("INVALID_DEPARTMENT", "Department not found in this school");
}
async function validateDesignation(scope: OrgScope, designationId: string): Promise<void> {
  const row = await prisma.designation.findFirst({ where: { id: designationId, schoolId: scope.schoolId }, select: { id: true } });
  if (!row) throw new HttpError("INVALID_DESIGNATION", "Designation not found in this school");
}

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export const createJobOpeningSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    departmentId: z.string().min(1).optional(),
    designationId: z.string().min(1).optional(),
    employmentType: z.enum(EMP_VALUES).optional(),
    openings: z.number().int().min(1).max(999).optional(),
    description: z.string().trim().max(4000).optional(),
    requirements: z.string().trim().max(4000).optional(),
    publishDate: dateSchema.optional(),
    closingDate: dateSchema.optional(),
  })
  .refine((v) => !v.publishDate || !v.closingDate || v.closingDate >= v.publishDate, { message: "Closing date must be on or after the publish date", path: ["closingDate"] });

export async function createJobOpening(scope: OrgScope, raw: unknown): Promise<JobOpeningDto> {
  const input = parseInput(createJobOpeningSchema, raw);
  if (input.departmentId) await validateDepartment(scope, input.departmentId);
  if (input.designationId) await validateDesignation(scope, input.designationId);
  const branchId = await resolveBranch(scope);
  const row = await prisma.jobOpening.create({
    data: {
      tenantId: scope.tenantId, schoolId: scope.schoolId, branchId,
      title: input.title, departmentId: input.departmentId, designationId: input.designationId,
      employmentType: input.employmentType ? (EMP_TO_DB[input.employmentType] as never) : undefined,
      openings: input.openings ?? 1, description: input.description, requirements: input.requirements,
      publishDate: input.publishDate ? new Date(`${input.publishDate}T00:00:00Z`) : null,
      closingDate: input.closingDate ? new Date(`${input.closingDate}T00:00:00Z`) : null,
      createdByUserId: scope.actor.id, createdByName: scope.actor.name,
    },
    select: openingSelect,
  });
  await recordAudit(prisma, scope, "JOB_OPENING_CREATED", "JobOpening", row.id, { title: row.title });
  return openingDto(row);
}

export const updateJobOpeningSchema = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    departmentId: z.string().min(1).nullable().optional(),
    designationId: z.string().min(1).nullable().optional(),
    employmentType: z.enum(EMP_VALUES).nullable().optional(),
    openings: z.number().int().min(1).max(999).optional(),
    description: z.string().trim().max(4000).nullable().optional(),
    requirements: z.string().trim().max(4000).nullable().optional(),
    publishDate: dateSchema.nullable().optional(),
    closingDate: dateSchema.nullable().optional(),
  })
  .refine((v) => !v.publishDate || !v.closingDate || v.closingDate >= v.publishDate, { message: "Closing date must be on or after the publish date", path: ["closingDate"] });

export async function updateJobOpening(scope: OrgScope, openingId: string, raw: unknown): Promise<JobOpeningDto> {
  const input = parseInput(updateJobOpeningSchema, raw);
  await requireOpeningRow(scope, openingId);
  if (input.departmentId) await validateDepartment(scope, input.departmentId);
  if (input.designationId) await validateDesignation(scope, input.designationId);
  const row = await prisma.jobOpening.update({
    where: { id: openingId },
    data: {
      title: input.title, departmentId: input.departmentId, designationId: input.designationId,
      employmentType: input.employmentType === undefined ? undefined : input.employmentType ? (EMP_TO_DB[input.employmentType] as never) : null,
      openings: input.openings, description: input.description, requirements: input.requirements,
      publishDate: input.publishDate === undefined ? undefined : input.publishDate ? new Date(`${input.publishDate}T00:00:00Z`) : null,
      closingDate: input.closingDate === undefined ? undefined : input.closingDate ? new Date(`${input.closingDate}T00:00:00Z`) : null,
      updatedByUserId: scope.actor.id, updatedByName: scope.actor.name,
    },
    select: openingSelect,
  });
  await recordAudit(prisma, scope, "JOB_OPENING_UPDATED", "JobOpening", openingId, input);
  return openingDto(row);
}

export async function setJobOpeningStatus(scope: OrgScope, openingId: string, status: JobOpeningStatusDto): Promise<JobOpeningDto> {
  await requireOpeningRow(scope, openingId);
  const row = await prisma.jobOpening.update({
    where: { id: openingId },
    data: { status: DTO_TO_OPENING_STATUS[status] as never, updatedByUserId: scope.actor.id, updatedByName: scope.actor.name },
    select: openingSelect,
  });
  await recordAudit(prisma, scope, "JOB_OPENING_STATUS_CHANGED", "JobOpening", openingId, { status });
  return openingDto(row);
}

// ── Applicants ───────────────────────────────────────────────────────────

type ApplicantRow = {
  id: string; jobOpeningId: string; candidateName: string; email: string; phone: string | null; source: string | null;
  notes: string | null; stage: string; appliedDate: Date; createdByName: string | null; updatedByName: string | null;
  createdAt: Date; updatedAt: Date; jobOpening: { title: string }; onboarding: { id: string } | null;
};

const applicantSelect = {
  id: true, jobOpeningId: true, candidateName: true, email: true, phone: true, source: true, notes: true, stage: true,
  appliedDate: true, createdByName: true, updatedByName: true, createdAt: true, updatedAt: true,
  jobOpening: { select: { title: true } }, onboarding: { select: { id: true } },
} satisfies Prisma.JobApplicantSelect;

function applicantDto(row: ApplicantRow): JobApplicantDto {
  return {
    id: row.id,
    jobOpeningId: row.jobOpeningId,
    jobOpeningTitle: row.jobOpening.title,
    candidateName: row.candidateName,
    email: row.email,
    phone: row.phone,
    source: row.source,
    notes: row.notes,
    stage: (STAGE_TO_DTO[row.stage] ?? "applied") as JobApplicantStageDto,
    appliedDate: toDate(row.appliedDate),
    hasOnboarding: Boolean(row.onboarding),
    createdByName: row.createdByName,
    updatedByName: row.updatedByName,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function requireApplicantRow(scope: OrgScope, applicantId: string): Promise<ApplicantRow> {
  const row = await prisma.jobApplicant.findFirst({
    where: { id: applicantId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) },
    select: applicantSelect,
  });
  if (!row) throw new HttpError("JOB_APPLICANT_NOT_FOUND", "Applicant not found");
  return row;
}

export async function listJobApplicants(scope: OrgScope, params: { jobOpeningId?: string; stage?: JobApplicantStageDto } = {}): Promise<JobApplicantDto[]> {
  const where: Prisma.JobApplicantWhereInput = { schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) };
  if (params.jobOpeningId) where.jobOpeningId = params.jobOpeningId;
  if (params.stage) where.stage = DTO_TO_STAGE[params.stage] as never;
  const rows = await prisma.jobApplicant.findMany({ where, select: applicantSelect, orderBy: { appliedDate: "desc" } });
  return rows.map(applicantDto);
}

export async function getJobApplicant(scope: OrgScope, applicantId: string): Promise<JobApplicantDto> {
  return applicantDto(await requireApplicantRow(scope, applicantId));
}

export const createJobApplicantSchema = z.object({
  jobOpeningId: z.string().min(1),
  candidateName: z.string().trim().min(1).max(160),
  email: z.string().trim().email().max(320),
  phone: z.string().trim().max(32).optional(),
  source: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(2000).optional(),
  appliedDate: dateSchema.optional(),
});

export async function createJobApplicant(scope: OrgScope, raw: unknown): Promise<JobApplicantDto> {
  const input = parseInput(createJobApplicantSchema, raw);
  const opening = await requireOpeningRow(scope, input.jobOpeningId);
  const row = await prisma.jobApplicant.create({
    data: {
      tenantId: scope.tenantId, schoolId: scope.schoolId, branchId: (await prisma.jobOpening.findUniqueOrThrow({ where: { id: opening.id }, select: { branchId: true } })).branchId,
      jobOpeningId: opening.id, candidateName: input.candidateName, email: input.email, phone: input.phone,
      source: input.source, notes: input.notes, appliedDate: new Date(`${input.appliedDate ?? new Date().toISOString().slice(0, 10)}T00:00:00Z`),
      createdByUserId: scope.actor.id, createdByName: scope.actor.name,
    },
    select: applicantSelect,
  });
  await recordAudit(prisma, scope, "JOB_APPLICANT_CREATED", "JobApplicant", row.id, { jobOpeningId: opening.id });
  return applicantDto(row);
}

export const updateJobApplicantSchema = z.object({
  candidateName: z.string().trim().min(1).max(160).optional(),
  email: z.string().trim().email().max(320).optional(),
  phone: z.string().trim().max(32).nullable().optional(),
  source: z.string().trim().max(80).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  appliedDate: dateSchema.optional(),
});

export async function updateJobApplicant(scope: OrgScope, applicantId: string, raw: unknown): Promise<JobApplicantDto> {
  const input = parseInput(updateJobApplicantSchema, raw);
  await requireApplicantRow(scope, applicantId);
  const row = await prisma.jobApplicant.update({
    where: { id: applicantId },
    data: {
      candidateName: input.candidateName, email: input.email, phone: input.phone, source: input.source, notes: input.notes,
      appliedDate: input.appliedDate ? new Date(`${input.appliedDate}T00:00:00Z`) : undefined,
      updatedByUserId: scope.actor.id, updatedByName: scope.actor.name,
    },
    select: applicantSelect,
  });
  await recordAudit(prisma, scope, "JOB_APPLICANT_UPDATED", "JobApplicant", applicantId, input);
  return applicantDto(row);
}

export async function setJobApplicantStage(scope: OrgScope, applicantId: string, stage: JobApplicantStageDto): Promise<JobApplicantDto> {
  const existing = await requireApplicantRow(scope, applicantId);
  const currentStage = (STAGE_TO_DTO[existing.stage] ?? "applied") as JobApplicantStageDto;
  if (!JOB_APPLICANT_NEXT_STAGE[currentStage].includes(stage)) {
    throw new HttpError("INVALID_APPLICANT_STAGE_TRANSITION", `Cannot move an applicant from "${currentStage}" to "${stage}"`);
  }
  const row = await prisma.jobApplicant.update({
    where: { id: applicantId },
    data: { stage: DTO_TO_STAGE[stage] as never, updatedByUserId: scope.actor.id, updatedByName: scope.actor.name },
    select: applicantSelect,
  });
  await recordAudit(prisma, scope, "JOB_APPLICANT_STAGE_CHANGED", "JobApplicant", applicantId, { stage });
  return applicantDto(row);
}

// ── Recruitment → Onboarding conversion ─────────────────────────────────
// Explicit action only — never a side effect of stage change. Reuses the
// EXISTING createStaff service; never a second employee-creation system.

export const startOnboardingSchema = z.object({
  employeeCode: z.string().trim().min(1).max(24),
  startDate: dateSchema,
  expectedCompletionDate: dateSchema.optional(),
  hrOwnerStaffId: z.string().min(1).optional(),
});

export async function startOnboardingFromApplicant(scope: OrgScope, applicantId: string, raw: unknown): Promise<EmployeeOnboardingDto> {
  const input = parseInput(startOnboardingSchema, raw);
  const applicant = await requireApplicantRow(scope, applicantId);
  const currentStage = (STAGE_TO_DTO[applicant.stage] ?? "applied") as JobApplicantStageDto;
  if (currentStage !== "selected") throw new HttpError("VALIDATION_ERROR", "Only a SELECTED applicant can start onboarding");
  if (applicant.onboarding) throw new HttpError("ONBOARDING_ALREADY_STARTED", "Onboarding has already been started for this applicant");

  const [firstName, ...rest] = applicant.candidateName.trim().split(/\s+/);
  const lastName = rest.length ? rest.join(" ") : undefined;

  // Reuse the existing Staff provisioning service — never a second employee-creation system.
  const staff = await createStaff(scope, { employeeCode: input.employeeCode, firstName, lastName, email: applicant.email, phone: applicant.phone ?? undefined });

  const onboarding = await startEmployeeOnboarding(scope, {
    staffId: staff.id,
    startDate: input.startDate,
    expectedCompletionDate: input.expectedCompletionDate,
    hrOwnerStaffId: input.hrOwnerStaffId,
    jobApplicantId: applicant.id,
  });

  await prisma.jobApplicant.update({
    where: { id: applicant.id },
    data: { stage: "HIRED", updatedByUserId: scope.actor.id, updatedByName: scope.actor.name },
  });
  await recordAudit(prisma, scope, "JOB_APPLICANT_STAGE_CHANGED", "JobApplicant", applicant.id, { stage: "hired" });

  return onboarding;
}
