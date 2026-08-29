// Staff / Teacher foundation service (Phase 6A) — real, PostgreSQL-backed.
//
// Staff is a SCHOOL-DOMAIN employee, distinct from the auth `User` (login
// identity). Tenant/school/branch scoped, NOT academic-session scoped. `userId`
// is an OPTIONAL 1:1 link to a login account — staff may exist without one, and a
// linked User is re-validated to actually be a member of the caller's tenant.
// Teaching eligibility is the explicit `isTeaching` flag (never inferred).
//
// AUTHORIZATION: the staff DIRECTORY is HR-domain (routes enforce hr.view /
// hr.manage). The teaching-staff RESOLVER (getTeachingStaff / the teacher options
// endpoint) is an Academics/Timetable prerequisite and is gated by academics.view
// so it is NOT blocked by the premium HR plan feature (see plan §11). Nothing is
// feature-gated here: basic staff identity is core, not a premium HR add-on.
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { CurrentStaffDto, EmploymentType, StaffDetailDto, StaffListItemDto, StaffStatus, TeachingStaffOptionDto } from "@/lib/api/contracts";

// UI kebab ↔ DB enum.
const EMP_TO_DB: Record<EmploymentType, string> = { "full-time": "FULL_TIME", "part-time": "PART_TIME", contract: "CONTRACT", temporary: "TEMPORARY" };
const empToUi = (e: string | null): EmploymentType | null => (e ? (e.toLowerCase().replace(/_/g, "-") as EmploymentType) : null);
const statusToUi = (s: string): StaffStatus => s.toLowerCase() as StaffStatus;
const STATUS_TO_DB: Record<StaffStatus, string> = { active: "ACTIVE", inactive: "INACTIVE", archived: "ARCHIVED" };

const empEnum = z.enum(["full-time", "part-time", "contract", "temporary"]);
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

export const createStaffSchema = z.object({
  employeeCode: z.string().trim().min(1).max(24),
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().max(60).optional(),
  displayName: z.string().trim().max(120).optional(),
  email: z.string().trim().email().max(320).optional(),
  phone: z.string().trim().max(32).optional(),
  designation: z.string().trim().max(60).optional(),
  department: z.string().trim().max(60).optional(),
  departmentId: z.string().min(1).optional(),
  designationId: z.string().min(1).optional(),
  employmentType: empEnum.optional(),
  isTeaching: z.boolean().optional(),
  joiningDate: dateStr.optional(),
  userId: z.string().min(1).optional(),
});
export const updateStaffSchema = z.object({
  employeeCode: z.string().trim().min(1).max(24).optional(),
  firstName: z.string().trim().min(1).max(60).optional(),
  lastName: z.string().trim().max(60).nullable().optional(),
  displayName: z.string().trim().max(120).nullable().optional(),
  email: z.string().trim().email().max(320).nullable().optional(),
  phone: z.string().trim().max(32).nullable().optional(),
  designation: z.string().trim().max(60).nullable().optional(),
  department: z.string().trim().max(60).nullable().optional(),
  departmentId: z.string().nullable().optional(),
  designationId: z.string().nullable().optional(),
  employmentType: empEnum.nullable().optional(),
  isTeaching: z.boolean().optional(),
  joiningDate: dateStr.nullable().optional(),
  reportsToStaffId: z.string().min(1).nullable().optional(),
});

// ── DTO ──────────────────────────────────────────────────────────────────

type StaffRow = {
  id: string; employeeCode: string; firstName: string; lastName: string | null; displayName: string | null;
  email: string | null; phone: string | null; designation: string | null; department: string | null;
  departmentId: string | null; designationId: string | null;
  employmentType: string | null; isTeaching: boolean; status: string; branchId: string; joiningDate: Date | null;
  userId: string | null; user?: { email: string } | null;
  reportsToStaffId: string | null; reportsTo?: { firstName: string; lastName: string | null; displayName: string | null } | null;
};
const displayName = (s: { displayName: string | null; firstName: string; lastName: string | null }) =>
  s.displayName?.trim() || `${s.firstName} ${s.lastName ?? ""}`.trim();

function listDto(s: StaffRow): StaffListItemDto {
  return {
    id: s.id, employeeCode: s.employeeCode, name: displayName(s), designation: s.designation, department: s.department,
    departmentId: s.departmentId, designationId: s.designationId,
    employmentType: empToUi(s.employmentType), isTeaching: s.isTeaching, status: statusToUi(s.status),
    branchId: s.branchId, email: s.email, hasUser: Boolean(s.userId),
    reportsToStaffId: s.reportsToStaffId, reportsToName: s.reportsTo ? displayName(s.reportsTo) : null,
  };
}
function detailDto(s: StaffRow): StaffDetailDto {
  return {
    ...listDto(s), firstName: s.firstName, lastName: s.lastName, displayName: s.displayName, phone: s.phone,
    joiningDate: s.joiningDate ? s.joiningDate.toISOString().slice(0, 10) : null,
    userId: s.userId, userEmail: s.user?.email ?? null,
  };
}
const listSelect = {
  id: true, employeeCode: true, firstName: true, lastName: true, displayName: true, email: true, phone: true,
  designation: true, department: true, departmentId: true, designationId: true,
  employmentType: true, isTeaching: true, status: true, branchId: true,
  joiningDate: true, userId: true, reportsToStaffId: true,
  reportsTo: { select: { firstName: true, lastName: true, displayName: true } },
} satisfies Prisma.StaffSelect;
const detailSelect = { ...listSelect, user: { select: { email: true } } } satisfies Prisma.StaffSelect;

/**
 * Resolve real Department/Designation FKs into the { departmentId,
 * designationId, department (name), designation (name) } write payload for
 * Staff.create/update. The FK is the authority; `department`/`designation`
 * become a transactionally-consistent display-name cache (never independently
 * settable once a real FK is provided) so every pre-Phase-9P consumer that
 * reads the plain string keeps working. Validates: same school, and (if the
 * designation is department-scoped) that it matches the EFFECTIVE department
 * on BOTH sides of the update — a designation-only change is checked against
 * the staff's current department, and a department-only change is checked
 * against the staff's current designation — so neither can silently drift
 * into a mismatch.
 */
async function resolveDeptDesigWrite(
  scope: OrgScope,
  input: { department?: string | null; designation?: string | null; departmentId?: string | null; designationId?: string | null },
  current: { departmentId: string | null; designationId: string | null } = { departmentId: null, designationId: null },
): Promise<{ department?: string | null; designation?: string | null; departmentId?: string | null; designationId?: string | null }> {
  const out: { department?: string | null; designation?: string | null; departmentId?: string | null; designationId?: string | null } = {};

  if (input.departmentId !== undefined) {
    if (input.departmentId === null) {
      out.departmentId = null;
    } else {
      const dept = await prisma.department.findFirst({ where: { id: input.departmentId, schoolId: scope.schoolId }, select: { id: true, name: true } });
      if (!dept) throw new HttpError("INVALID_DEPARTMENT", "Department not found in this school");
      out.departmentId = dept.id;
      out.department = dept.name;
    }
  } else if (input.department !== undefined) {
    out.department = input.department;
  }

  if (input.designationId !== undefined) {
    if (input.designationId === null) {
      out.designationId = null;
    } else {
      const desig = await prisma.designation.findFirst({ where: { id: input.designationId, schoolId: scope.schoolId }, select: { id: true, name: true, departmentId: true } });
      if (!desig) throw new HttpError("INVALID_DESIGNATION", "Designation not found in this school");
      const effectiveDeptId = input.departmentId !== undefined ? out.departmentId : current.departmentId;
      if (desig.departmentId && effectiveDeptId && effectiveDeptId !== desig.departmentId) {
        throw new HttpError("DESIGNATION_DEPARTMENT_MISMATCH", "This designation belongs to a different department");
      }
      out.designationId = desig.id;
      out.designation = desig.name;
    }
  } else if (input.designation !== undefined) {
    out.designation = input.designation;
  } else if (input.departmentId !== undefined && current.designationId) {
    // Department-only change: re-validate the staff's EXISTING designation against the new department.
    const currentDesig = await prisma.designation.findUnique({ where: { id: current.designationId }, select: { departmentId: true } });
    if (currentDesig?.departmentId && out.departmentId !== undefined && out.departmentId !== currentDesig.departmentId) {
      throw new HttpError("DESIGNATION_DEPARTMENT_MISMATCH", "The staff member's current designation belongs to a different department");
    }
  }

  return out;
}

// ── Scope + link helpers ────────────────────────────────────────────────────

async function requireStaffInScope(scope: OrgScope, staffId: string): Promise<{ id: string; userId: string | null; departmentId: string | null; designationId: string | null }> {
  const s = await prisma.staff.findFirst({
    where: { id: staffId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) },
    select: { id: true, userId: true, departmentId: true, designationId: true },
  });
  if (!s) throw new HttpError("NOT_FOUND", "Staff member not found");
  return s;
}

async function assertCodeFree(scope: OrgScope, code: string, exceptId?: string): Promise<void> {
  const clash = await prisma.staff.findFirst({
    where: { schoolId: scope.schoolId, employeeCode: { equals: code, mode: "insensitive" }, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  });
  if (clash) throw new HttpError("CONFLICT", "A staff member with this employee code already exists");
}

/** Validate an optional userId links a real User who is a member of THIS tenant + not already linked. */
async function validateUserLink(scope: OrgScope, userId: string, exceptStaffId?: string): Promise<void> {
  const member = await prisma.tenantMembership.findFirst({ where: { userId, tenantId: scope.tenantId, status: "ACTIVE" }, select: { id: true } });
  if (!member) throw new HttpError("VALIDATION_ERROR", "The linked user is not an active member of this organisation");
  const existing = await prisma.staff.findFirst({ where: { userId, ...(exceptStaffId ? { id: { not: exceptStaffId } } : {}) }, select: { id: true } });
  if (existing) throw new HttpError("CONFLICT", "That user is already linked to another staff record");
}

// ── Reads ──────────────────────────────────────────────────────────────────

export type ListStaffParams = { search?: string; status?: string; branchId?: string; teaching?: boolean; departmentId?: string; designationId?: string; sort?: string; page?: number; pageSize?: number };

export async function listStaff(scope: OrgScope, params: ListStaffParams = {}): Promise<StaffListItemDto[]> {
  const where: Prisma.StaffWhereInput = { schoolId: scope.schoolId };
  if (scope.branchId) where.branchId = scope.branchId;
  else if (params.branchId) where.branchId = params.branchId;
  if (params.status && params.status in STATUS_TO_DB) where.status = STATUS_TO_DB[params.status as StaffStatus] as never;
  if (params.teaching !== undefined) where.isTeaching = params.teaching;
  if (params.departmentId) where.departmentId = params.departmentId;
  if (params.designationId) where.designationId = params.designationId;
  if (params.search?.trim()) {
    const q = params.search.trim();
    where.OR = [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { displayName: { contains: q, mode: "insensitive" } },
      { employeeCode: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }
  const orderBy: Prisma.StaffOrderByWithRelationInput[] = params.sort === "code" ? [{ employeeCode: "asc" }] : [{ firstName: "asc" }, { lastName: "asc" }];
  const take = params.pageSize && params.pageSize > 0 ? params.pageSize : undefined;
  const skip = take && params.page && params.page > 1 ? (params.page - 1) * take : undefined;
  const rows = await prisma.staff.findMany({ where, orderBy, select: listSelect, take, skip });
  return rows.map(listDto);
}

export async function getStaff(scope: OrgScope, staffId: string): Promise<StaffDetailDto> {
  await requireStaffInScope(scope, staffId);
  const s = await prisma.staff.findUniqueOrThrow({ where: { id: staffId }, select: detailSelect });
  return detailDto(s);
}

/**
 * Canonical resolver: ACTIVE, teaching-eligible, in-scope staff. The ONE source
 * of teacher options for Academics/Timetable — reuse this, never re-filter.
 */
export async function getTeachingStaff(scope: OrgScope, opts: { branchId?: string } = {}): Promise<TeachingStaffOptionDto[]> {
  const where: Prisma.StaffWhereInput = { schoolId: scope.schoolId, status: "ACTIVE", isTeaching: true };
  const branchId = scope.branchId ?? opts.branchId;
  if (branchId) where.branchId = branchId;
  const rows = await prisma.staff.findMany({
    where, orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: { id: true, employeeCode: true, firstName: true, lastName: true, displayName: true, designation: true },
  });
  return rows.map((s) => ({ id: s.id, name: displayName(s), employeeCode: s.employeeCode, designation: s.designation }));
}

/**
 * Canonical resolver (Phase 9A): the authenticated actor's own real Staff
 * profile, via User → Staff.userId — never inferred from email/name/role
 * string. Returns null when the actor has no linked, ACTIVE Staff record in
 * this school (e.g. a SCHOOL_ADMIN with no employee record, or a Staff row
 * that was deactivated) — callers show an honest empty/deferred state, never
 * fabricate a teacher identity.
 */
export async function getCurrentStaffProfile(scope: OrgScope): Promise<CurrentStaffDto | null> {
  const staff = await prisma.staff.findFirst({
    where: { userId: scope.actor.id, schoolId: scope.schoolId, status: "ACTIVE" },
    select: { id: true, employeeCode: true, firstName: true, lastName: true, displayName: true, designation: true, isTeaching: true },
  });
  if (!staff) return null;
  return { id: staff.id, employeeCode: staff.employeeCode, name: displayName(staff), designation: staff.designation, isTeaching: staff.isTeaching };
}

// ── Mutations ────────────────────────────────────────────────────────────────

/** Resolve the branch a new staff record belongs to (active branch, else single ACTIVE). */
async function resolveStaffBranch(scope: OrgScope): Promise<string> {
  if (scope.branchId) return scope.branchId;
  const active = await prisma.branch.findMany({ where: { schoolId: scope.schoolId, status: "ACTIVE" }, select: { id: true } });
  if (active.length === 1) return active[0].id;
  throw new HttpError("INVALID_BRANCH", "Select a branch for this staff member");
}

export async function createStaff(scope: OrgScope, raw: unknown): Promise<StaffDetailDto> {
  const input = parseInput(createStaffSchema, raw);
  await assertCodeFree(scope, input.employeeCode);
  const branchId = await resolveStaffBranch(scope);
  if (input.userId) await validateUserLink(scope, input.userId);
  const deptDesig = await resolveDeptDesigWrite(scope, input);
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.staff.create({
      data: {
        tenantId: scope.tenantId, schoolId: scope.schoolId, branchId, employeeCode: input.employeeCode,
        firstName: input.firstName, lastName: input.lastName, displayName: input.displayName, email: input.email,
        phone: input.phone, department: deptDesig.department, designation: deptDesig.designation,
        departmentId: deptDesig.departmentId, designationId: deptDesig.designationId,
        employmentType: input.employmentType ? (EMP_TO_DB[input.employmentType] as never) : undefined,
        isTeaching: input.isTeaching ?? false,
        joiningDate: input.joiningDate ? new Date(`${input.joiningDate}T00:00:00.000Z`) : undefined,
        userId: input.userId,
      },
      select: detailSelect,
    });
    await recordAudit(tx, scope, "STAFF_CREATED", "Staff", row.id, { employeeCode: row.employeeCode });
    if (input.userId) await recordAudit(tx, scope, "STAFF_USER_LINKED", "Staff", row.id, { userId: input.userId });
    return row;
  });
  return detailDto(created);
}

/** A staff member cannot report to themselves or to anyone in their own downward chain (would create a cycle). No deeper enterprise cycle-graph needed — one direct-self and one-hop check covers the realistic data-entry mistakes. */
async function assertNotReportingCycle(scope: OrgScope, staffId: string, reportsToStaffId: string): Promise<void> {
  if (reportsToStaffId === staffId) throw new HttpError("VALIDATION_ERROR", "A staff member cannot report to themselves");
  const manager = await prisma.staff.findFirst({ where: { id: reportsToStaffId, schoolId: scope.schoolId }, select: { id: true, reportsToStaffId: true } });
  if (!manager) throw new HttpError("NOT_FOUND", "Manager not found");
  if (manager.reportsToStaffId === staffId) throw new HttpError("VALIDATION_ERROR", "This would create a reporting cycle");
}

export async function updateStaff(scope: OrgScope, staffId: string, raw: unknown): Promise<StaffDetailDto> {
  const input = parseInput(updateStaffSchema, raw);
  const current = await requireStaffInScope(scope, staffId);
  if (input.employeeCode) await assertCodeFree(scope, input.employeeCode, staffId);
  if (input.reportsToStaffId) await assertNotReportingCycle(scope, staffId, input.reportsToStaffId);
  const deptDesig = await resolveDeptDesigWrite(scope, input, { departmentId: current.departmentId, designationId: current.designationId });
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.staff.update({
      where: { id: staffId },
      data: {
        employeeCode: input.employeeCode, firstName: input.firstName, lastName: input.lastName, displayName: input.displayName,
        email: input.email, phone: input.phone, department: deptDesig.department, designation: deptDesig.designation,
        departmentId: deptDesig.departmentId, designationId: deptDesig.designationId,
        employmentType: input.employmentType === undefined ? undefined : input.employmentType === null ? null : (EMP_TO_DB[input.employmentType] as never),
        isTeaching: input.isTeaching,
        joiningDate: input.joiningDate === undefined ? undefined : input.joiningDate === null ? null : new Date(`${input.joiningDate}T00:00:00.000Z`),
        reportsToStaffId: input.reportsToStaffId,
      },
      select: detailSelect,
    });
    await recordAudit(tx, scope, "STAFF_UPDATED", "Staff", staffId);
    return row;
  });
  return detailDto(updated);
}

export async function setStaffStatus(scope: OrgScope, staffId: string, status: StaffStatus): Promise<StaffDetailDto> {
  await requireStaffInScope(scope, staffId);
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.staff.update({ where: { id: staffId }, data: { status: STATUS_TO_DB[status] as never }, select: detailSelect });
    await recordAudit(tx, scope, "STAFF_STATUS_CHANGED", "Staff", staffId, { status });
    return row;
  });
  return detailDto(updated);
}

/** Link or unlink a login account (userId null → unlink). Validated + audited. */
export async function setStaffUser(scope: OrgScope, staffId: string, userId: string | null): Promise<StaffDetailDto> {
  const current = await requireStaffInScope(scope, staffId);
  if (userId) await validateUserLink(scope, userId, staffId);
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.staff.update({ where: { id: staffId }, data: { userId }, select: detailSelect });
    await recordAudit(tx, scope, userId ? "STAFF_USER_LINKED" : "STAFF_USER_UNLINKED", "Staff", staffId, { userId: userId ?? current.userId });
    return row;
  });
  return detailDto(updated);
}
