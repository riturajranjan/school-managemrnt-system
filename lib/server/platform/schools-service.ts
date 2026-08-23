// Platform (Super Admin) school management + provisioning (Phase SA-2).
//
// This is PLATFORM scope, not tenant scope: callers are platform admins (gated
// by `platform.schools.*` permissions in the routes) and the server creates all
// org ownership itself — no tenantId/schoolId/roleId is ever trusted from the
// client. Provisioning is a single all-or-nothing Prisma transaction so a school
// never exists without its tenant, primary branch, current session and admin.
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { parseInput } from "@/lib/server/validation";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit, type AuditAction } from "@/lib/server/api/audit";
import type { OrgScope } from "@/lib/server/api/scope";
import type { ListMeta } from "@/lib/server/api/response";
import { schoolStatusFromUi, schoolStatusToUi } from "@/lib/server/api/enums";
import { REQUIRED_STEP_KEYS } from "@/lib/api/onboarding-steps";
import type { Prisma } from "@/lib/generated/prisma/client";
import { createPasswordSetupToken } from "@/lib/server/auth/password-setup";

export type PlatformActor = { id: string; name: string | null };

/** Build the audit scope for a platform action targeting a tenant/school. */
function auditScope(actor: PlatformActor, tenantId: string, schoolId: string | null): OrgScope {
  return { tenantId, schoolId: schoolId ?? "", branchId: null, academicSessionId: null, actor };
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "school";
}

// --- Validation -------------------------------------------------------------

const optionalStr = z.string().trim().min(1).optional();
const dateStr = z.string().trim().refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date");

export const provisionSchema = z.object({
  school: z.object({
    name: z.string().trim().min(1, "School name is required").max(200),
    code: z.string().trim().min(1, "School code is required").max(40),
    email: z.string().trim().toLowerCase().email().optional(),
    phone: optionalStr,
    timezone: optionalStr,
    schoolType: optionalStr,
    board: optionalStr,
  }),
  branch: z
    .object({ name: optionalStr, code: optionalStr })
    .optional(),
  academicSession: z.object({
    name: z.string().trim().min(1, "Session name is required").max(60),
    code: optionalStr,
    startDate: dateStr,
    endDate: dateStr,
  }),
  admin: z.object({
    firstName: z.string().trim().min(1, "Admin first name is required").max(120),
    lastName: z.string().trim().min(1, "Admin last name is required").max(120),
    email: z.string().trim().toLowerCase().email("Enter a valid admin email"),
  }),
});

export const schoolUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    shortName: optionalStr,
    email: z.string().trim().toLowerCase().email().optional(),
    phone: optionalStr,
    website: optionalStr,
    schoolType: optionalStr,
    board: optionalStr,
    timezone: optionalStr,
  })
  .partial();

export const statusSchema = z.object({
  status: z.enum(["active", "suspended"]),
});

// --- Serializers ------------------------------------------------------------

function serializeSchoolListItem(
  s: Prisma.SchoolGetPayload<{
    include: { tenant: { select: { id: true; name: true; slug: true; status: true } }; _count: { select: { branches: true } } };
  }>,
  currentSessionName: string | null,
) {
  return {
    id: s.id,
    name: s.name,
    code: s.code,
    status: schoolStatusToUi[s.status],
    tenantId: s.tenantId,
    tenantName: s.tenant.name,
    tenantSlug: s.tenant.slug,
    branchCount: s._count.branches,
    currentSessionName,
    createdAt: s.createdAt.toISOString(),
  };
}

// --- Reads ------------------------------------------------------------------

export type SchoolListParams = {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  sort?: "name" | "createdAt";
  order?: "asc" | "desc";
};

export async function listSchools(params: SchoolListParams) {
  const where: Prisma.SchoolWhereInput = {};
  if (params.search) {
    const q = params.search.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { code: { contains: q, mode: "insensitive" } },
      { tenant: { name: { contains: q, mode: "insensitive" } } },
    ];
  }
  if (params.status) {
    const dbStatus = schoolStatusFromUi[params.status];
    if (dbStatus) where.status = dbStatus;
  }

  const orderBy: Prisma.SchoolOrderByWithRelationInput =
    params.sort === "createdAt" ? { createdAt: params.order ?? "desc" } : { name: params.order ?? "asc" };

  const [total, rows] = await Promise.all([
    prisma.school.count({ where }),
    prisma.school.findMany({
      where,
      orderBy,
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      include: {
        tenant: { select: { id: true, name: true, slug: true, status: true } },
        _count: { select: { branches: true } },
      },
    }),
  ]);

  // Current session names in one query.
  const sessions = await prisma.academicSession.findMany({
    where: { schoolId: { in: rows.map((r) => r.id) }, isCurrent: true },
    select: { schoolId: true, name: true },
  });
  const sessionBySchool = new Map(sessions.map((s) => [s.schoolId, s.name]));

  const meta: ListMeta = {
    page: params.page,
    pageSize: params.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
  };
  return { data: rows.map((r) => serializeSchoolListItem(r, sessionBySchool.get(r.id) ?? null)), meta };
}

/** Platform-safe school detail. NO student/guardian/admission/secret data. */
export async function getSchoolDetail(schoolId: string) {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    include: {
      tenant: { select: { id: true, name: true, slug: true, status: true } },
      branches: { select: { id: true, name: true, code: true, isPrimary: true, status: true, city: true }, orderBy: [{ isPrimary: "desc" }, { name: "asc" }] },
      academicSessions: { select: { id: true, name: true, code: true, startDate: true, endDate: true, isCurrent: true, status: true }, orderBy: [{ isCurrent: "desc" }, { startDate: "desc" }] },
    },
  });
  if (!school) throw new HttpError("NOT_FOUND", "School not found");

  // School Admin memberships for this tenant (platform-safe user fields only).
  const memberships = await prisma.tenantMembership.findMany({
    where: { tenantId: school.tenantId, roleAssignments: { some: { role: { key: "SCHOOL_ADMIN" } } } },
    select: {
      status: true,
      user: { select: { id: true, name: true, email: true, status: true, passwordSetupRequired: true } },
    },
  });

  const currentSession = school.academicSessions.find((s) => s.isCurrent) ?? null;

  return {
    school: {
      id: school.id,
      name: school.name,
      shortName: school.shortName,
      code: school.code,
      schoolType: school.schoolType,
      board: school.board,
      email: school.email,
      phone: school.phone,
      website: school.website,
      timezone: school.timezone,
      locale: school.locale,
      currency: school.currency,
      status: schoolStatusToUi[school.status],
      setupPending: school.status === "SETUP_PENDING",
      createdAt: school.createdAt.toISOString(),
      updatedAt: school.updatedAt.toISOString(),
    },
    tenant: { id: school.tenant.id, name: school.tenant.name, slug: school.tenant.slug, status: school.tenant.status.toLowerCase() },
    branches: school.branches.map((b) => ({ id: b.id, name: b.name, code: b.code, isPrimary: b.isPrimary, status: b.status.toLowerCase(), city: b.city })),
    currentSession: currentSession
      ? {
          id: currentSession.id,
          name: currentSession.name,
          code: currentSession.code,
          startDate: currentSession.startDate.toISOString().slice(0, 10),
          endDate: currentSession.endDate.toISOString().slice(0, 10),
        }
      : null,
    admins: memberships.map((m) => ({
      userId: m.user.id,
      name: m.user.name,
      email: m.user.email,
      status: m.user.status.toLowerCase(),
      invitePending: m.user.passwordSetupRequired || m.user.status === "INVITED",
    })),
  };
}

// --- Provisioning (all-or-nothing transaction) ------------------------------

export type ProvisionResult = {
  schoolId: string;
  tenantId: string;
  adminUserId: string;
  adminInvitePending: boolean;
  // Phase 9W.2 — real one-time setup link (null when reusing an existing
  // ACTIVE user, which already has a password). No email is sent; the
  // platform admin shares this manually.
  adminPasswordSetupUrl: string | null;
};

export async function provisionSchool(actor: PlatformActor, raw: unknown): Promise<ProvisionResult> {
  const input = parseInput(provisionSchema, raw);

  // Session dates.
  const start = new Date(input.academicSession.startDate);
  const end = new Date(input.academicSession.endDate);
  if (start >= end) throw new HttpError("INVALID_SESSION_DATES", "Session start date must be before the end date");

  // Global school-code uniqueness (platform-level; codes are otherwise only
  // unique per tenant, but each provisioning creates its own tenant).
  const codeClash = await prisma.school.findFirst({
    where: { code: { equals: input.school.code, mode: "insensitive" } },
    select: { id: true },
  });
  if (codeClash) throw new HttpError("SCHOOL_CODE_EXISTS", "A school with this code already exists");

  // Unique tenant slug.
  const base = slugify(input.school.code || input.school.name);
  let slug = base;
  for (let i = 2; ; i++) {
    const taken = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
    if (!taken) break;
    slug = `${base}-${i}`;
    if (i > 50) throw new HttpError("SCHOOL_SLUG_EXISTS", "Could not derive a unique tenant slug");
  }

  const adminEmail = input.admin.email;
  const adminName = `${input.admin.firstName} ${input.admin.lastName}`.trim();
  const timezone = input.school.timezone ?? "Asia/Kolkata";

  return prisma.$transaction(async (tx) => {
    // Resolve the seeded SCHOOL_ADMIN system role.
    const schoolAdminRole = await tx.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true }, select: { id: true } });
    if (!schoolAdminRole) throw new HttpError("SERVER_ERROR", "SCHOOL_ADMIN role is not configured");

    // Admin user: reuse if the email already exists (never touch their password);
    // otherwise create an INVITED user that must set a password later.
    const existingUser = await tx.user.findUnique({ where: { email: adminEmail }, select: { id: true, status: true, passwordSetupRequired: true } });
    let adminUserId: string;
    let adminInvitePending: boolean;
    if (existingUser) {
      adminUserId = existingUser.id;
      adminInvitePending = existingUser.passwordSetupRequired || existingUser.status === "INVITED";
    } else {
      const created = await tx.user.create({
        data: {
          email: adminEmail,
          name: adminName,
          passwordHash: null,
          status: "INVITED",
          passwordSetupRequired: true,
        },
        select: { id: true },
      });
      adminUserId = created.id;
      adminInvitePending = true; // invitation pending — no email delivery yet
    }

    const tenant = await tx.tenant.create({
      data: { name: input.school.name, slug, status: "ACTIVE", timezone },
      select: { id: true },
    });

    const school = await tx.school.create({
      data: {
        tenantId: tenant.id,
        name: input.school.name,
        code: input.school.code,
        email: input.school.email ?? null,
        phone: input.school.phone ?? null,
        schoolType: input.school.schoolType ?? null,
        board: input.school.board ?? null,
        timezone,
        status: "SETUP_PENDING", // onboarding required (SA-3)
      },
      select: { id: true },
    });

    await tx.branch.create({
      data: {
        schoolId: school.id,
        name: input.branch?.name ?? "Main Campus",
        code: input.branch?.code ?? "MAIN",
        isPrimary: true,
        status: "ACTIVE",
      },
    });

    await tx.academicSession.create({
      data: {
        schoolId: school.id,
        name: input.academicSession.name,
        code: input.academicSession.code ?? slugify(input.academicSession.name).toUpperCase(),
        startDate: start,
        endDate: end,
        status: "ACTIVE",
        isCurrent: true,
      },
    });

    const membership = await tx.tenantMembership.create({
      data: { userId: adminUserId, tenantId: tenant.id, status: "ACTIVE" },
      select: { id: true },
    });
    await tx.roleAssignment.create({ data: { membershipId: membership.id, roleId: schoolAdminRole.id } });

    // Onboarding record so every SETUP_PENDING school is resumable (SA-3).
    await tx.schoolOnboarding.create({
      data: {
        tenantId: tenant.id,
        schoolId: school.id,
        status: "IN_PROGRESS",
        currentStep: REQUIRED_STEP_KEYS[0],
        completedSteps: [],
      },
    });

    await recordAudit(tx, auditScope(actor, tenant.id, school.id), "SCHOOL_CREATED", "School", school.id, {
      code: input.school.code,
      adminEmail,
      adminCreated: !existingUser,
    });

    // Phase 9W.2 — only issue a setup link for an invite-pending account (a
    // reused, already-ACTIVE admin already has a password).
    const adminPasswordSetupUrl = adminInvitePending ? `/setup-password?token=${(await createPasswordSetupToken(tx, adminUserId)).token}` : null;

    return { schoolId: school.id, tenantId: tenant.id, adminUserId, adminInvitePending, adminPasswordSetupUrl };
  });
}

// --- Update -----------------------------------------------------------------

export async function updateSchool(actor: PlatformActor, schoolId: string, raw: unknown) {
  const input = parseInput(schoolUpdateSchema, raw);
  const existing = await prisma.school.findUnique({ where: { id: schoolId }, select: { id: true, tenantId: true } });
  if (!existing) throw new HttpError("NOT_FOUND", "School not found");

  const data: Prisma.SchoolUpdateInput = {};
  const set = (k: string, v: unknown) => {
    (data as Record<string, unknown>)[k] = v;
  };
  if (input.name !== undefined) set("name", input.name);
  if (input.shortName !== undefined) set("shortName", input.shortName ?? null);
  if (input.email !== undefined) set("email", input.email ?? null);
  if (input.phone !== undefined) set("phone", input.phone ?? null);
  if (input.website !== undefined) set("website", input.website ?? null);
  if (input.schoolType !== undefined) set("schoolType", input.schoolType ?? null);
  if (input.board !== undefined) set("board", input.board ?? null);
  if (input.timezone !== undefined) set("timezone", input.timezone ?? null);

  await prisma.school.update({ where: { id: schoolId }, data });
  await recordAudit(prisma, auditScope(actor, existing.tenantId, schoolId), "SCHOOL_UPDATED", "School", schoolId);
  return getSchoolDetail(schoolId);
}

// --- Suspend / reactivate ---------------------------------------------------

export async function setSchoolStatus(actor: PlatformActor, schoolId: string, raw: unknown) {
  const input = parseInput(statusSchema, raw);
  const existing = await prisma.school.findUnique({ where: { id: schoolId }, select: { id: true, tenantId: true, status: true } });
  if (!existing) throw new HttpError("NOT_FOUND", "School not found");

  const nextStatus = input.status === "suspended" ? "SUSPENDED" : "ACTIVE";
  if (existing.status === nextStatus) {
    throw new HttpError("CONFLICT", `School is already ${input.status}`);
  }
  await prisma.school.update({ where: { id: schoolId }, data: { status: nextStatus } });

  const action: AuditAction = nextStatus === "SUSPENDED" ? "SCHOOL_SUSPENDED" : "SCHOOL_REACTIVATED";
  await recordAudit(prisma, auditScope(actor, existing.tenantId, schoolId), action, "School", schoolId, { from: existing.status, to: nextStatus });
  return getSchoolDetail(schoolId);
}
