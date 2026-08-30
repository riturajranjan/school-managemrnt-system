// User List — View Profile / Edit Account / View Activity (User Account
// Creation Foundation, continued). Reuses the exact same authorization
// boundary as listAccounts/provisionAccount (users.manage + tenant/school
// scoping + the TEACHER teaching-scope restriction) — no new permission
// system. Edit Account delegates to the EXISTING real updateStaff/
// updateStudent/updateGuardian services for a deliberately narrow, real field
// subset (never a client-writable Branch, since neither service supports
// reassigning branchId — that capability does not exist, so it is not
// offered here). Activity reuses the existing AuditEvent model — no new
// audit table, and this module never selects passwordHash or any token.
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { parseInput } from "@/lib/server/validation";
import type { OrgScope } from "@/lib/server/api/scope";
import type { AuthzContext } from "@/lib/server/authz/permissions";
import { updateStaff } from "@/lib/server/staff/service";
import { updateStudent } from "@/lib/server/students/service";
import { updateGuardian } from "@/lib/server/guardians/service";
import { isTeacherScopedActor, requireTeacherScopedTarget } from "@/lib/server/users/provisioning";

async function requireVisibleTarget(ctx: AuthzContext, scope: OrgScope, userId: string): Promise<void> {
  const membership = await prisma.tenantMembership.findUnique({
    where: { userId_tenantId: { userId, tenantId: scope.tenantId } },
    select: { id: true },
  });
  if (!membership) throw new HttpError("USER_NOT_FOUND", "User not found");
  if (await isTeacherScopedActor(ctx, scope)) await requireTeacherScopedTarget(scope, ctx.user.id, userId);
}

type DomainKind = "staff" | "student" | "guardian" | null;

async function loadDomainIds(userId: string): Promise<{ kind: DomainKind; staffId: string | null; studentId: string | null; guardianId: string | null }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { staffProfile: { select: { id: true } }, studentProfile: { select: { id: true } }, guardianProfile: { select: { id: true } } },
  });
  if (!user) throw new HttpError("USER_NOT_FOUND", "User not found");
  const kind: DomainKind = user.staffProfile ? "staff" : user.studentProfile ? "student" : user.guardianProfile ? "guardian" : null;
  return { kind, staffId: user.staffProfile?.id ?? null, studentId: user.studentProfile?.id ?? null, guardianId: user.guardianProfile?.id ?? null };
}

export type AccountDetailDto = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  status: string;
  emailVerifiedAt: string | null;
  passwordSetupRequired: boolean;
  hasPassword: boolean;
  createdAt: string;
  updatedAt: string;
  roles: { key: string; name: string }[];
  domainKind: DomainKind;
  staffId: string | null;
  studentId: string | null;
  guardianId: string | null;
  personal: {
    firstName: string | null;
    lastName: string | null;
    gender: string | null;
    dateOfBirth: string | null;
    mobile: string | null;
    contactEmail: string | null;
    photoUrl: string | null;
  };
  schoolAssignment: {
    schoolName: string | null;
    branchId: string | null;
    branchName: string | null;
    designation: string | null;
    department: string | null;
    joiningDate: string | null;
  } | null;
  access: {
    schoolId: string | null;
    branchId: string | null;
    rolePermissions: { roleKey: string; roleName: string; permissions: string[] }[];
    effectivePermissions: string[];
  };
};

export async function getAccountDetail(ctx: AuthzContext, scope: OrgScope, userId: string): Promise<AccountDetailDto> {
  await requireVisibleTarget(ctx, scope, userId);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      status: true,
      emailVerifiedAt: true,
      passwordSetupRequired: true,
      // Selected ONLY to derive the boolean `hasPassword` below — never
      // placed into the returned DTO.
      passwordHash: true,
      createdAt: true,
      updatedAt: true,
      staffProfile: {
        select: { id: true, firstName: true, lastName: true, phone: true, email: true, branchId: true, designation: true, department: true, joiningDate: true, schoolId: true },
      },
      studentProfile: {
        select: { id: true, firstName: true, lastName: true, gender: true, dateOfBirth: true, phone: true, email: true, branchId: true, photoUrl: true, schoolId: true },
      },
      guardianProfile: { select: { id: true, firstName: true, lastName: true, phone: true, email: true, photoUrl: true } },
      memberships: {
        where: { tenantId: scope.tenantId },
        select: { roleAssignments: { select: { role: { select: { key: true, name: true, permissions: { select: { permission: { select: { key: true } } } } } } } } },
        take: 1,
      },
    },
  });
  if (!user) throw new HttpError("USER_NOT_FOUND", "User not found");
  const hasPasswordHash = Boolean(user.passwordHash);

  const roleAssignments = user.memberships[0]?.roleAssignments ?? [];
  const roles = roleAssignments.map((ra) => ({ key: ra.role.key, name: ra.role.name }));
  const rolePermissions = roleAssignments.map((ra) => ({
    roleKey: ra.role.key,
    roleName: ra.role.name,
    permissions: ra.role.permissions.map((p) => p.permission.key).sort(),
  }));
  const effectivePermissions = [...new Set(rolePermissions.flatMap((r) => r.permissions))].sort();

  const branchId = user.staffProfile?.branchId ?? user.studentProfile?.branchId ?? null;
  const branch = branchId ? await prisma.branch.findUnique({ where: { id: branchId }, select: { name: true } }) : null;
  const school = user.staffProfile || user.studentProfile ? await prisma.school.findUnique({ where: { id: (user.staffProfile ?? user.studentProfile)!.schoolId }, select: { name: true } }) : null;

  const domainKind: DomainKind = user.staffProfile ? "staff" : user.studentProfile ? "student" : user.guardianProfile ? "guardian" : null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
    status: user.status,
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
    passwordSetupRequired: user.passwordSetupRequired,
    hasPassword: hasPasswordHash,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    roles,
    domainKind,
    staffId: user.staffProfile?.id ?? null,
    studentId: user.studentProfile?.id ?? null,
    guardianId: user.guardianProfile?.id ?? null,
    personal: {
      firstName: user.staffProfile?.firstName ?? user.studentProfile?.firstName ?? user.guardianProfile?.firstName ?? null,
      lastName: user.staffProfile?.lastName ?? user.studentProfile?.lastName ?? user.guardianProfile?.lastName ?? null,
      // Gender/DOB exist only on Student — Staff and Guardian have no such
      // columns in this schema; null here means "not tracked for this
      // account kind", never a fabricated default.
      gender: user.studentProfile?.gender ?? null,
      dateOfBirth: user.studentProfile?.dateOfBirth?.toISOString().slice(0, 10) ?? null,
      mobile: user.staffProfile?.phone ?? user.studentProfile?.phone ?? user.guardianProfile?.phone ?? null,
      contactEmail: user.staffProfile?.email ?? user.studentProfile?.email ?? user.guardianProfile?.email ?? null,
      // Staff has no photoUrl column at all.
      photoUrl: user.studentProfile?.photoUrl ?? user.guardianProfile?.photoUrl ?? null,
    },
    schoolAssignment:
      domainKind === "guardian" || domainKind === null
        ? null
        : {
            schoolName: school?.name ?? null,
            branchId,
            branchName: branch?.name ?? null,
            designation: user.staffProfile?.designation ?? null,
            department: user.staffProfile?.department ?? null,
            joiningDate: user.staffProfile?.joiningDate?.toISOString().slice(0, 10) ?? null,
          },
    access: {
      schoolId: (user.staffProfile ?? user.studentProfile)?.schoolId ?? null,
      branchId,
      rolePermissions,
      effectivePermissions,
    },
  };
}

// Deliberately narrow — only fields a REAL update service actually supports
// are accepted. Branch is never here: neither updateStaff nor updateStudent
// exposes a branchId field (no branch-reassignment capability exists), so
// offering one would be a fake control. Login email (User.email, the auth
// identity) is likewise never edited here — there is no re-verification flow
// for changing it; "email" below is each domain record's own contact email
// field, which the real update services already support and dedupe.
const editAccountSchema = z.object({
  firstName: z.string().trim().min(1).max(120).optional(),
  lastName: z.string().trim().min(1).max(120).optional(),
  gender: z.enum(["male", "female", "other", "prefer-not-to-say"]).optional(),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  phone: z.string().trim().max(32).optional(),
  email: z.string().trim().email().max(320).optional(),
  photoUrl: z.string().trim().max(2048).optional(),
  designationId: z.string().min(1).optional(),
  joiningDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

const STAFF_FIELDS = new Set(["firstName", "lastName", "phone", "email", "designationId", "joiningDate"]);
const STUDENT_FIELDS = new Set(["firstName", "lastName", "gender", "dateOfBirth", "phone", "email", "photoUrl"]);
const GUARDIAN_FIELDS = new Set(["firstName", "lastName", "phone", "email", "photoUrl"]);

export async function updateAccountDetail(ctx: AuthzContext, scope: OrgScope, userId: string, raw: unknown): Promise<AccountDetailDto> {
  await requireVisibleTarget(ctx, scope, userId);
  const input = parseInput(editAccountSchema, raw);
  const { kind, staffId, studentId, guardianId } = await loadDomainIds(userId);
  if (!kind) throw new HttpError("VALIDATION_ERROR", "This account has no editable profile record linked");

  const allowed = kind === "staff" ? STAFF_FIELDS : kind === "student" ? STUDENT_FIELDS : GUARDIAN_FIELDS;
  const rejected = Object.keys(input).filter((k) => !allowed.has(k));
  if (rejected.length > 0) {
    throw new HttpError("VALIDATION_ERROR", `These fields are not editable for a ${kind} account: ${rejected.join(", ")}`);
  }

  if (kind === "staff") {
    await updateStaff(scope, staffId!, { firstName: input.firstName, lastName: input.lastName, phone: input.phone, email: input.email, designationId: input.designationId, joiningDate: input.joiningDate });
  } else if (kind === "student") {
    await updateStudent(scope, studentId!, { firstName: input.firstName, lastName: input.lastName, gender: input.gender, dateOfBirth: input.dateOfBirth, phone: input.phone, email: input.email, photoUrl: input.photoUrl });
  } else {
    await updateGuardian(scope, guardianId!, { firstName: input.firstName, lastName: input.lastName, phone: input.phone, email: input.email, photoUrl: input.photoUrl });
  }

  return getAccountDetail(ctx, scope, userId);
}

export type ActivityEntry = {
  id: string;
  action: string;
  entityType: string;
  createdAt: string;
  actorName: string | null;
  meta: Record<string, unknown> | null;
};

const SENSITIVE_META_KEY = /password|token|hash|secret/i;

/** Strip any accidentally-sensitive-looking key defensively — recordAudit
 * callers never store these, but this is a second, independent line of
 * defense specifically because this endpoint surfaces raw metaJson to the UI. */
function sanitizeMeta(meta: unknown): Record<string, unknown> | null {
  if (!meta || typeof meta !== "object") return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta as Record<string, unknown>)) {
    if (SENSITIVE_META_KEY.test(k)) continue;
    out[k] = v;
  }
  return out;
}

/** Real AuditEvent history for this account — its own User-level events plus
 * events on whichever single domain record (Staff/Student/Guardian) it is
 * linked to. No new audit table; capped at `limit` most recent, newest first. */
export async function getAccountActivity(ctx: AuthzContext, scope: OrgScope, userId: string, limit = 50): Promise<ActivityEntry[]> {
  await requireVisibleTarget(ctx, scope, userId);
  const { staffId, studentId, guardianId } = await loadDomainIds(userId);

  const entityConditions: { entityType: string; entityId: string }[] = [{ entityType: "User", entityId: userId }];
  if (staffId) entityConditions.push({ entityType: "Staff", entityId: staffId });
  if (studentId) entityConditions.push({ entityType: "Student", entityId: studentId });
  if (guardianId) entityConditions.push({ entityType: "Guardian", entityId: guardianId });

  const events = await prisma.auditEvent.findMany({
    where: { tenantId: scope.tenantId, OR: entityConditions },
    select: { id: true, action: true, entityType: true, createdAt: true, actorName: true, metaJson: true },
    orderBy: { createdAt: "desc" },
    take: Math.min(200, Math.max(1, limit)),
  });

  return events.map((e) => ({
    id: e.id,
    action: e.action,
    entityType: e.entityType,
    createdAt: e.createdAt.toISOString(),
    actorName: e.actorName,
    meta: sanitizeMeta(e.metaJson),
  }));
}
