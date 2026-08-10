// Student domain service (Backend Phase 4). Real PostgreSQL. Every query is
// constrained by scope.tenantId + scope.schoolId (tenant/school isolation), and
// list results are additionally filtered by the validated request params. The
// server assigns tenant/school/branch/session — never trusting client-provided
// ownership. Identity/profile only: academic/fee/attendance summaries belong to
// their future modules and are NOT produced here.
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { parseInput } from "@/lib/server/validation";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { resolveCreateBranch, resolveCreateSession, type OrgScope } from "@/lib/server/api/scope";
import type { ListMeta } from "@/lib/server/api/response";
import {
  admissionTypeFromUi,
  admissionTypeToUi,
  docVerificationToUi,
  genderFromUi,
  genderToUi,
  guardianRelationToUi,
  studentStatusFromUi,
  studentStatusToUi,
} from "@/lib/server/api/enums";
import { findOrCreateGuardian, guardianCreateSchema, serializeGuardian } from "@/lib/server/guardians/service";
import { guardianRelationFromUi } from "@/lib/server/api/enums";
import type { Prisma } from "@/lib/generated/prisma/client";

// --- Validation -------------------------------------------------------------

const nonEmpty = z.string().trim().min(1);
const optionalStr = z.string().trim().min(1).optional();
const dateStr = z.string().trim().refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date");
const genderUi = z.enum(["male", "female", "other", "prefer-not-to-say"]);
const admissionTypeUi = z.enum(["new", "transfer", "sibling", "staff-ward", "management-quota"]);
const statusUi = z.enum(["active", "inactive", "alumni", "transferred", "archived"]);

const addressShape = {
  addressLine1: optionalStr,
  addressLine2: optionalStr,
  city: optionalStr,
  state: optionalStr,
  country: optionalStr,
  postalCode: optionalStr,
};

const inlineGuardianSchema = guardianCreateSchema.extend({
  relation: z.enum(["father", "mother", "guardian"]).default("guardian"),
  isPrimary: z.boolean().optional(),
  isEmergencyContact: z.boolean().optional(),
  authorizedPickup: z.boolean().optional(),
  isFeeResponsible: z.boolean().optional(),
});

export const studentCreateSchema = z.object({
  admissionNumber: nonEmpty.max(60),
  rollNumber: optionalStr,
  firstName: nonEmpty.max(120),
  middleName: optionalStr,
  lastName: nonEmpty.max(120),
  preferredName: optionalStr,
  dateOfBirth: dateStr,
  gender: genderUi.default("prefer-not-to-say"),
  bloodGroup: optionalStr,
  nationality: optionalStr,
  religion: optionalStr,
  category: optionalStr,
  motherTongue: optionalStr,
  house: optionalStr,
  photoUrl: optionalStr,
  email: z.string().trim().toLowerCase().email().optional(),
  phone: optionalStr,
  classLabel: optionalStr,
  sectionLabel: optionalStr,
  admissionDate: dateStr.optional(),
  admissionType: admissionTypeUi.default("new"),
  status: statusUi.default("active"),
  ...addressShape,
  branchId: z.string().trim().min(1).optional(),
  academicSessionId: z.string().trim().min(1).optional(),
  guardians: z.array(inlineGuardianSchema).optional(),
});

// Update: identity/profile mutable; org ids are NOT (protected immutable scope).
export const studentUpdateSchema = z
  .object({
    admissionNumber: nonEmpty.max(60),
    rollNumber: optionalStr,
    firstName: nonEmpty.max(120),
    middleName: optionalStr,
    lastName: nonEmpty.max(120),
    preferredName: optionalStr,
    dateOfBirth: dateStr,
    gender: genderUi,
    bloodGroup: optionalStr,
    nationality: optionalStr,
    religion: optionalStr,
    category: optionalStr,
    motherTongue: optionalStr,
    house: optionalStr,
    photoUrl: optionalStr,
    email: z.string().trim().toLowerCase().email().optional(),
    phone: optionalStr,
    classLabel: optionalStr,
    sectionLabel: optionalStr,
    admissionType: admissionTypeUi,
    status: statusUi,
    ...addressShape,
  })
  .partial();

// --- Serializers ------------------------------------------------------------

type StudentRow = Prisma.StudentGetPayload<object>;

export function serializeStudentSummary(s: StudentRow) {
  return {
    id: s.id,
    admissionNumber: s.admissionNumber,
    rollNumber: s.rollNumber,
    firstName: s.firstName,
    middleName: s.middleName,
    lastName: s.lastName,
    fullName: [s.firstName, s.middleName, s.lastName].filter(Boolean).join(" "),
    preferredName: s.preferredName,
    gender: genderToUi[s.gender],
    dateOfBirth: s.dateOfBirth.toISOString().slice(0, 10),
    classLabel: s.classLabel,
    sectionLabel: s.sectionLabel,
    status: studentStatusToUi[s.status],
    admissionType: admissionTypeToUi[s.admissionType],
    admissionDate: s.admissionDate.toISOString().slice(0, 10),
    branchId: s.branchId,
    academicSessionId: s.academicSessionId,
    photoUrl: s.photoUrl,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

function serializeProfile(s: StudentRow) {
  return {
    ...serializeStudentSummary(s),
    bloodGroup: s.bloodGroup,
    nationality: s.nationality,
    religion: s.religion,
    category: s.category,
    motherTongue: s.motherTongue,
    house: s.house,
    email: s.email,
    phone: s.phone,
    address: {
      line1: s.addressLine1,
      line2: s.addressLine2,
      city: s.city,
      state: s.state,
      country: s.country,
      postalCode: s.postalCode,
    },
    sourceApplicationId: s.sourceApplicationId,
    archivedAt: s.archivedAt?.toISOString() ?? null,
  };
}

// --- Reads ------------------------------------------------------------------

export const studentSortFields = ["name", "admissionNumber", "createdAt", "admissionDate"] as const;
export type StudentSort = (typeof studentSortFields)[number];

export type StudentListParams = {
  page: number;
  pageSize: number;
  search?: string;
  status?: string[];
  admissionType?: string[];
  gender?: string[];
  classLabel?: string;
  sectionLabel?: string;
  branchId?: string;
  academicSessionId?: string;
  sort?: StudentSort;
  order?: "asc" | "desc";
};

export async function listStudents(scope: OrgScope, params: StudentListParams) {
  const where: Prisma.StudentWhereInput = { tenantId: scope.tenantId, schoolId: scope.schoolId };

  if (params.search) {
    const q = params.search.trim();
    where.OR = [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { admissionNumber: { contains: q, mode: "insensitive" } },
      { rollNumber: { contains: q, mode: "insensitive" } },
    ];
  }
  if (params.status?.length) {
    where.status = { in: params.status.map((s) => studentStatusFromUi[s]).filter(Boolean) };
  }
  if (params.admissionType?.length) {
    where.admissionType = { in: params.admissionType.map((t) => admissionTypeFromUi[t]).filter(Boolean) };
  }
  if (params.gender?.length) {
    where.gender = { in: params.gender.map((g) => genderFromUi[g]).filter(Boolean) };
  }
  if (params.classLabel) where.classLabel = params.classLabel;
  if (params.sectionLabel) where.sectionLabel = params.sectionLabel;
  if (params.branchId) where.branchId = params.branchId;
  if (params.academicSessionId) where.academicSessionId = params.academicSessionId;

  const order = params.order ?? "asc";
  let orderBy: Prisma.StudentOrderByWithRelationInput | Prisma.StudentOrderByWithRelationInput[];
  switch (params.sort) {
    case "admissionNumber":
      orderBy = { admissionNumber: order };
      break;
    case "createdAt":
      orderBy = { createdAt: order };
      break;
    case "admissionDate":
      orderBy = { admissionDate: order };
      break;
    default:
      orderBy = [{ firstName: order }, { lastName: order }];
  }

  const [total, rows] = await Promise.all([
    prisma.student.count({ where }),
    prisma.student.findMany({
      where,
      orderBy,
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
  ]);
  const meta: ListMeta = {
    page: params.page,
    pageSize: params.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
  };
  return { data: rows.map(serializeStudentSummary), meta };
}

export async function getStudentDetail(scope: OrgScope, studentId: string) {
  const s = await prisma.student.findFirst({
    where: { id: studentId, tenantId: scope.tenantId, schoolId: scope.schoolId },
    include: {
      guardians: { include: { guardian: true }, orderBy: { createdAt: "asc" } },
      documents: { orderBy: { createdAt: "asc" } },
      timeline: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!s) throw new HttpError("NOT_FOUND", "Student not found");

  let admission: { id: string; applicationNumber: string; enrolledAt: string | null } | null = null;
  if (s.sourceApplicationId) {
    const app = await prisma.admissionApplication.findFirst({
      where: { id: s.sourceApplicationId, tenantId: scope.tenantId },
      select: { id: true, applicationNumber: true, enrolledAt: true },
    });
    if (app) admission = { id: app.id, applicationNumber: app.applicationNumber, enrolledAt: app.enrolledAt?.toISOString() ?? null };
  }

  return {
    ...serializeProfile(s),
    guardians: s.guardians.map((l) => ({
      link: {
        relation: guardianRelationToUi[l.relation],
        isPrimary: l.isPrimary,
        isEmergencyContact: l.isEmergencyContact,
        authorizedPickup: l.authorizedPickup,
        isFeeResponsible: l.isFeeResponsible,
      },
      guardian: serializeGuardian(l.guardian),
    })),
    documents: s.documents.map((d) => ({
      id: d.id,
      type: d.type,
      displayName: d.displayName,
      status: d.status,
      verificationStatus: docVerificationToUi[d.verificationStatus],
      fileName: d.fileName,
      expiryDate: d.expiryDate ? d.expiryDate.toISOString().slice(0, 10) : null,
      notes: d.notes,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    })),
    timeline: s.timeline.map((e) => ({
      id: e.id,
      type: e.type,
      title: e.title,
      detail: e.detail,
      category: e.category,
      actorName: e.actorName,
      createdAt: e.createdAt.toISOString(),
    })),
    admission,
  };
}

// --- Writes -----------------------------------------------------------------

async function assertAdmissionNumberFree(
  db: Prisma.TransactionClient | typeof prisma,
  schoolId: string,
  admissionNumber: string,
  excludeStudentId?: string,
): Promise<void> {
  const existing = await db.student.findFirst({
    where: { schoolId, admissionNumber, ...(excludeStudentId ? { id: { not: excludeStudentId } } : {}) },
    select: { id: true },
  });
  if (existing) throw new HttpError("DUPLICATE_ADMISSION_NUMBER", "Admission number already in use");
}

export async function createStudent(scope: OrgScope, raw: unknown) {
  const input = parseInput(studentCreateSchema, raw);
  const branchId = await resolveCreateBranch(scope, input.branchId);
  const academicSessionId = await resolveCreateSession(scope, input.academicSessionId);

  return prisma.$transaction(async (tx) => {
    await assertAdmissionNumberFree(tx, scope.schoolId, input.admissionNumber);

    const student = await tx.student.create({
      data: {
        tenantId: scope.tenantId,
        schoolId: scope.schoolId,
        branchId,
        academicSessionId,
        admissionNumber: input.admissionNumber,
        rollNumber: input.rollNumber ?? null,
        firstName: input.firstName,
        middleName: input.middleName ?? null,
        lastName: input.lastName,
        preferredName: input.preferredName ?? null,
        dateOfBirth: new Date(input.dateOfBirth),
        gender: genderFromUi[input.gender],
        bloodGroup: input.bloodGroup ?? null,
        nationality: input.nationality ?? null,
        religion: input.religion ?? null,
        category: input.category ?? null,
        motherTongue: input.motherTongue ?? null,
        house: input.house ?? null,
        photoUrl: input.photoUrl ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        classLabel: input.classLabel ?? null,
        sectionLabel: input.sectionLabel ?? null,
        admissionDate: input.admissionDate ? new Date(input.admissionDate) : new Date(),
        admissionType: admissionTypeFromUi[input.admissionType],
        status: studentStatusFromUi[input.status],
        addressLine1: input.addressLine1 ?? null,
        addressLine2: input.addressLine2 ?? null,
        city: input.city ?? null,
        state: input.state ?? null,
        country: input.country ?? null,
        postalCode: input.postalCode ?? null,
      },
    });

    // Optional inline guardians (find-or-create + link).
    if (input.guardians?.length) {
      let primaryAssigned = false;
      for (const g of input.guardians) {
        const { id: guardianId } = await findOrCreateGuardian(tx, scope, g);
        const isPrimary = Boolean(g.isPrimary) && !primaryAssigned;
        if (isPrimary) primaryAssigned = true;
        await tx.studentGuardian.upsert({
          where: { studentId_guardianId: { studentId: student.id, guardianId } },
          update: {},
          create: {
            studentId: student.id,
            guardianId,
            relation: guardianRelationFromUi[g.relation],
            isPrimary,
            isEmergencyContact: Boolean(g.isEmergencyContact),
            authorizedPickup: Boolean(g.authorizedPickup),
            isFeeResponsible: Boolean(g.isFeeResponsible),
          },
        });
      }
    }

    await tx.studentTimelineEvent.create({
      data: {
        studentId: student.id,
        type: "ADMITTED",
        title: "Student admitted",
        category: "system",
        actorUserId: scope.actor.id,
        actorName: scope.actor.name,
      },
    });
    await recordAudit(tx, scope, "STUDENT_CREATED", "Student", student.id, { admissionNumber: student.admissionNumber });
    return serializeProfile(student);
  });
}

export async function updateStudent(scope: OrgScope, studentId: string, raw: unknown) {
  const input = parseInput(studentUpdateSchema, raw);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.student.findFirst({
      where: { id: studentId, tenantId: scope.tenantId, schoolId: scope.schoolId },
      select: { id: true, status: true },
    });
    if (!existing) throw new HttpError("NOT_FOUND", "Student not found");

    if (input.admissionNumber) {
      await assertAdmissionNumberFree(tx, scope.schoolId, input.admissionNumber, studentId);
    }

    const data: Prisma.StudentUpdateInput = {};
    const assign = <K extends keyof Prisma.StudentUpdateInput>(k: K, v: Prisma.StudentUpdateInput[K]) => {
      (data as Record<string, unknown>)[k as string] = v;
    };
    if (input.admissionNumber !== undefined) assign("admissionNumber", input.admissionNumber);
    if (input.rollNumber !== undefined) assign("rollNumber", input.rollNumber ?? null);
    if (input.firstName !== undefined) assign("firstName", input.firstName);
    if (input.middleName !== undefined) assign("middleName", input.middleName ?? null);
    if (input.lastName !== undefined) assign("lastName", input.lastName);
    if (input.preferredName !== undefined) assign("preferredName", input.preferredName ?? null);
    if (input.dateOfBirth !== undefined) assign("dateOfBirth", new Date(input.dateOfBirth));
    if (input.gender !== undefined) assign("gender", genderFromUi[input.gender]);
    if (input.bloodGroup !== undefined) assign("bloodGroup", input.bloodGroup ?? null);
    if (input.nationality !== undefined) assign("nationality", input.nationality ?? null);
    if (input.religion !== undefined) assign("religion", input.religion ?? null);
    if (input.category !== undefined) assign("category", input.category ?? null);
    if (input.motherTongue !== undefined) assign("motherTongue", input.motherTongue ?? null);
    if (input.house !== undefined) assign("house", input.house ?? null);
    if (input.photoUrl !== undefined) assign("photoUrl", input.photoUrl ?? null);
    if (input.email !== undefined) assign("email", input.email ?? null);
    if (input.phone !== undefined) assign("phone", input.phone ?? null);
    if (input.classLabel !== undefined) assign("classLabel", input.classLabel ?? null);
    if (input.sectionLabel !== undefined) assign("sectionLabel", input.sectionLabel ?? null);
    if (input.admissionType !== undefined) assign("admissionType", admissionTypeFromUi[input.admissionType]);
    if (input.addressLine1 !== undefined) assign("addressLine1", input.addressLine1 ?? null);
    if (input.addressLine2 !== undefined) assign("addressLine2", input.addressLine2 ?? null);
    if (input.city !== undefined) assign("city", input.city ?? null);
    if (input.state !== undefined) assign("state", input.state ?? null);
    if (input.country !== undefined) assign("country", input.country ?? null);
    if (input.postalCode !== undefined) assign("postalCode", input.postalCode ?? null);

    let statusChanged = false;
    if (input.status !== undefined) {
      const nextStatus = studentStatusFromUi[input.status];
      assign("status", nextStatus);
      assign("archivedAt", nextStatus === "ARCHIVED" ? new Date() : null);
      statusChanged = nextStatus !== existing.status;
    }

    const updated = await tx.student.update({ where: { id: studentId }, data });
    await tx.studentTimelineEvent.create({
      data: {
        studentId,
        type: statusChanged ? "STATUS_CHANGED" : "PROFILE_UPDATED",
        title: statusChanged ? `Status changed to ${input.status}` : "Profile updated",
        category: "system",
        actorUserId: scope.actor.id,
        actorName: scope.actor.name,
      },
    });
    await recordAudit(tx, scope, "STUDENT_UPDATED", "Student", studentId);
    return serializeProfile(updated);
  });
}

/** Archive (soft-delete). Never a hard delete — the domain is enrolment-history bearing. */
export async function archiveStudent(scope: OrgScope, studentId: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.student.findFirst({
      where: { id: studentId, tenantId: scope.tenantId, schoolId: scope.schoolId },
      select: { id: true, status: true },
    });
    if (!existing) throw new HttpError("NOT_FOUND", "Student not found");
    if (existing.status === "ARCHIVED") throw new HttpError("CONFLICT", "Student is already archived");

    const updated = await tx.student.update({
      where: { id: studentId },
      data: { status: "ARCHIVED", archivedAt: new Date() },
    });
    await tx.studentTimelineEvent.create({
      data: {
        studentId,
        type: "STATUS_CHANGED",
        title: "Student archived",
        category: "system",
        actorUserId: scope.actor.id,
        actorName: scope.actor.name,
      },
    });
    await recordAudit(tx, scope, "STUDENT_ARCHIVED", "Student", studentId);
    return serializeProfile(updated);
  });
}
