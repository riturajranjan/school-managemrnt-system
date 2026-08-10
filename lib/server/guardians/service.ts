// Guardian domain service (Backend Phase 4). Real PostgreSQL, tenant-scoped.
// Every query is constrained by scope.tenantId; students are additionally
// constrained by scope.schoolId. Deduplication is conservative: a guardian is
// reused when an existing tenant guardian matches by email (preferred) or phone.
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { parseInput } from "@/lib/server/validation";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import type { OrgScope } from "@/lib/server/api/scope";
import type { ListMeta } from "@/lib/server/api/response";
import { guardianRelationFromUi, guardianRelationToUi, studentStatusToUi } from "@/lib/server/api/enums";
import type { Prisma } from "@/lib/generated/prisma/client";

// --- Validation schemas -----------------------------------------------------

const nonEmpty = z.string().trim().min(1);
const optionalStr = z.string().trim().min(1).optional();
const emailSchema = z.string().trim().toLowerCase().email().optional();

export const guardianCreateSchema = z.object({
  firstName: nonEmpty.max(120),
  lastName: nonEmpty.max(120),
  email: emailSchema,
  phone: optionalStr.pipe(z.string().max(40)).optional(),
  occupation: optionalStr,
  organization: optionalStr,
  addressLine1: optionalStr,
  addressLine2: optionalStr,
  city: optionalStr,
  state: optionalStr,
  country: optionalStr,
  postalCode: optionalStr,
  photoUrl: optionalStr,
});

export const guardianUpdateSchema = guardianCreateSchema.partial();

const relationUi = z.enum(["father", "mother", "guardian"]);

export const guardianLinkSchema = z.object({
  // Link an existing guardian…
  guardianId: z.string().trim().min(1).optional(),
  // …or create a new one inline.
  guardian: guardianCreateSchema.optional(),
  relation: relationUi.default("guardian"),
  isPrimary: z.boolean().optional(),
  isEmergencyContact: z.boolean().optional(),
  authorizedPickup: z.boolean().optional(),
  isFeeResponsible: z.boolean().optional(),
});

// --- Serializers ------------------------------------------------------------

type GuardianRow = Prisma.GuardianGetPayload<{ include: { students: false } }>;

export function serializeGuardian(g: GuardianRow) {
  return {
    id: g.id,
    firstName: g.firstName,
    lastName: g.lastName,
    fullName: `${g.firstName} ${g.lastName}`.trim(),
    email: g.email,
    phone: g.phone,
    occupation: g.occupation,
    organization: g.organization,
    address: {
      line1: g.addressLine1,
      line2: g.addressLine2,
      city: g.city,
      state: g.state,
      country: g.country,
      postalCode: g.postalCode,
    },
    photoUrl: g.photoUrl,
    hasPortalAccount: Boolean(g.userId),
    createdAt: g.createdAt.toISOString(),
    updatedAt: g.updatedAt.toISOString(),
  };
}

// --- Reads ------------------------------------------------------------------

export async function listGuardians(
  scope: OrgScope,
  opts: { page: number; pageSize: number; search?: string },
): Promise<{ data: ReturnType<typeof serializeGuardian>[]; meta: ListMeta }> {
  const where: Prisma.GuardianWhereInput = { tenantId: scope.tenantId };
  if (opts.search) {
    const q = opts.search.trim();
    where.OR = [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
    ];
  }
  const [total, rows] = await Promise.all([
    prisma.guardian.count({ where }),
    prisma.guardian.findMany({
      where,
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      skip: (opts.page - 1) * opts.pageSize,
      take: opts.pageSize,
      include: {
        students: {
          select: {
            relation: true,
            isPrimary: true,
            isEmergencyContact: true,
            authorizedPickup: true,
            isFeeResponsible: true,
            student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true, classLabel: true, sectionLabel: true, status: true } },
          },
        },
      },
    }),
  ]);
  const data = rows.map((g) => ({
    ...serializeGuardian(g),
    children: g.students.map((l) => ({
      relation: guardianRelationToUi[l.relation],
      isPrimary: l.isPrimary,
      isEmergencyContact: l.isEmergencyContact,
      authorizedPickup: l.authorizedPickup,
      isFeeResponsible: l.isFeeResponsible,
      student: {
        id: l.student.id,
        name: `${l.student.firstName} ${l.student.lastName}`.trim(),
        admissionNumber: l.student.admissionNumber,
        classLabel: l.student.classLabel,
        sectionLabel: l.student.sectionLabel,
        status: studentStatusToUi[l.student.status],
      },
    })),
  }));
  return {
    data,
    meta: { page: opts.page, pageSize: opts.pageSize, total, totalPages: Math.max(1, Math.ceil(total / opts.pageSize)) },
  };
}

export async function getGuardian(scope: OrgScope, guardianId: string) {
  const g = await prisma.guardian.findFirst({
    where: { id: guardianId, tenantId: scope.tenantId },
    include: {
      students: {
        select: {
          relation: true,
          isPrimary: true,
          isEmergencyContact: true,
          authorizedPickup: true,
          isFeeResponsible: true,
          student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true, classLabel: true, sectionLabel: true, status: true } },
        },
      },
    },
  });
  if (!g) throw new HttpError("NOT_FOUND", "Guardian not found");
  return {
    ...serializeGuardian(g),
    children: g.students.map((l) => ({
      relation: guardianRelationToUi[l.relation],
      isPrimary: l.isPrimary,
      isEmergencyContact: l.isEmergencyContact,
      authorizedPickup: l.authorizedPickup,
      isFeeResponsible: l.isFeeResponsible,
      student: {
        id: l.student.id,
        name: `${l.student.firstName} ${l.student.lastName}`.trim(),
        admissionNumber: l.student.admissionNumber,
        classLabel: l.student.classLabel,
        sectionLabel: l.student.sectionLabel,
        status: studentStatusToUi[l.student.status],
      },
    })),
  };
}

// --- Writes -----------------------------------------------------------------

type GuardianInput = z.infer<typeof guardianCreateSchema>;

function guardianData(scope: OrgScope, input: GuardianInput) {
  return {
    tenantId: scope.tenantId,
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email ?? null,
    phone: input.phone ?? null,
    occupation: input.occupation ?? null,
    organization: input.organization ?? null,
    addressLine1: input.addressLine1 ?? null,
    addressLine2: input.addressLine2 ?? null,
    city: input.city ?? null,
    state: input.state ?? null,
    country: input.country ?? null,
    postalCode: input.postalCode ?? null,
    photoUrl: input.photoUrl ?? null,
  };
}

/**
 * Find an existing tenant guardian matching by email (preferred) or phone, or
 * create a new one. Conservative: only exact email/phone matches are reused.
 * Runs on the provided client so it can join a conversion transaction.
 */
export async function findOrCreateGuardian(
  db: Prisma.TransactionClient | typeof prisma,
  scope: OrgScope,
  input: GuardianInput,
): Promise<{ id: string; created: boolean }> {
  const email = input.email ?? null;
  const phone = input.phone ?? null;
  if (email) {
    const byEmail = await db.guardian.findFirst({ where: { tenantId: scope.tenantId, email }, select: { id: true } });
    if (byEmail) return { id: byEmail.id, created: false };
  } else if (phone) {
    const byPhone = await db.guardian.findFirst({ where: { tenantId: scope.tenantId, phone }, select: { id: true } });
    if (byPhone) return { id: byPhone.id, created: false };
  }
  const created = await db.guardian.create({ data: guardianData(scope, input), select: { id: true } });
  return { id: created.id, created: true };
}

export async function createGuardian(scope: OrgScope, raw: unknown) {
  const input = parseInput(guardianCreateSchema, raw);
  // Conservative dedup: reject an exact email match rather than silently merging.
  if (input.email) {
    const existing = await prisma.guardian.findFirst({
      where: { tenantId: scope.tenantId, email: input.email },
      select: { id: true },
    });
    if (existing) throw new HttpError("CONFLICT", "A guardian with this email already exists");
  }
  const created = await prisma.guardian.create({ data: guardianData(scope, input) });
  await recordAudit(prisma, scope, "GUARDIAN_CREATED", "Guardian", created.id);
  return serializeGuardian(created);
}

export async function updateGuardian(scope: OrgScope, guardianId: string, raw: unknown) {
  const input = parseInput(guardianUpdateSchema, raw);
  const existing = await prisma.guardian.findFirst({ where: { id: guardianId, tenantId: scope.tenantId }, select: { id: true } });
  if (!existing) throw new HttpError("NOT_FOUND", "Guardian not found");
  if (input.email) {
    const clash = await prisma.guardian.findFirst({
      where: { tenantId: scope.tenantId, email: input.email, id: { not: guardianId } },
      select: { id: true },
    });
    if (clash) throw new HttpError("CONFLICT", "Another guardian already uses this email");
  }
  const data: Prisma.GuardianUpdateInput = {};
  for (const [k, v] of Object.entries(input)) {
    (data as Record<string, unknown>)[k] = v ?? null;
  }
  const updated = await prisma.guardian.update({ where: { id: guardianId }, data });
  await recordAudit(prisma, scope, "GUARDIAN_UPDATED", "Guardian", guardianId);
  return serializeGuardian(updated);
}

/** Ensure a student is in scope (tenant + school). Returns its id. */
async function requireScopedStudent(
  db: Prisma.TransactionClient | typeof prisma,
  scope: OrgScope,
  studentId: string,
): Promise<string> {
  const student = await db.student.findFirst({
    where: { id: studentId, tenantId: scope.tenantId, schoolId: scope.schoolId },
    select: { id: true },
  });
  if (!student) throw new HttpError("NOT_FOUND", "Student not found");
  return student.id;
}

export async function linkGuardianToStudent(scope: OrgScope, studentId: string, raw: unknown) {
  const input = parseInput(guardianLinkSchema, raw);
  if (!input.guardianId && !input.guardian) {
    throw new HttpError("VALIDATION_ERROR", "Provide guardianId or guardian details");
  }

  return prisma.$transaction(async (tx) => {
    await requireScopedStudent(tx, scope, studentId);

    let guardianId = input.guardianId ?? null;
    if (guardianId) {
      const g = await tx.guardian.findFirst({ where: { id: guardianId, tenantId: scope.tenantId }, select: { id: true } });
      if (!g) throw new HttpError("NOT_FOUND", "Guardian not found");
    } else if (input.guardian) {
      const result = await findOrCreateGuardian(tx, scope, input.guardian);
      guardianId = result.id;
      if (result.created) await recordAudit(tx, scope, "GUARDIAN_CREATED", "Guardian", guardianId);
    }
    if (!guardianId) throw new HttpError("VALIDATION_ERROR", "Guardian could not be resolved");

    const existingLink = await tx.studentGuardian.findUnique({
      where: { studentId_guardianId: { studentId, guardianId } },
      select: { id: true },
    });
    if (existingLink) throw new HttpError("CONFLICT", "This guardian is already linked to the student");

    // Enforce a single primary guardian per student.
    if (input.isPrimary) {
      await tx.studentGuardian.updateMany({ where: { studentId }, data: { isPrimary: false } });
    }

    const link = await tx.studentGuardian.create({
      data: {
        studentId,
        guardianId,
        relation: guardianRelationFromUi[input.relation],
        isPrimary: input.isPrimary ?? false,
        isEmergencyContact: input.isEmergencyContact ?? false,
        authorizedPickup: input.authorizedPickup ?? false,
        isFeeResponsible: input.isFeeResponsible ?? false,
      },
    });
    await tx.studentTimelineEvent.create({
      data: {
        studentId,
        type: "GUARDIAN_LINKED",
        title: "Guardian linked",
        category: "system",
        actorUserId: scope.actor.id,
        actorName: scope.actor.name,
      },
    });
    await recordAudit(tx, scope, "GUARDIAN_LINKED", "Student", studentId, { guardianId });
    return { linkId: link.id, guardianId };
  });
}

export async function unlinkGuardianFromStudent(scope: OrgScope, studentId: string, guardianId: string) {
  return prisma.$transaction(async (tx) => {
    await requireScopedStudent(tx, scope, studentId);
    const link = await tx.studentGuardian.findUnique({
      where: { studentId_guardianId: { studentId, guardianId } },
      select: { id: true },
    });
    if (!link) throw new HttpError("NOT_FOUND", "Guardian is not linked to this student");
    await tx.studentGuardian.delete({ where: { id: link.id } });
    await tx.studentTimelineEvent.create({
      data: {
        studentId,
        type: "GUARDIAN_UNLINKED",
        title: "Guardian unlinked",
        category: "system",
        actorUserId: scope.actor.id,
        actorName: scope.actor.name,
      },
    });
    await recordAudit(tx, scope, "GUARDIAN_UNLINKED", "Student", studentId, { guardianId });
    return { success: true };
  });
}
