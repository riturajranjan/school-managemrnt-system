// Admissions domain service (Backend Phase 4). Real PostgreSQL, scoped to
// tenant + school. Owns the application pipeline (stage workflow persisted to
// AdmissionStageHistory) and the critical convert-to-Student transaction, which
// is all-or-nothing and guarded against double conversion.
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { parseInput } from "@/lib/server/validation";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { resolveCreateBranch, resolveCreateSession, type OrgScope } from "@/lib/server/api/scope";
import type { ListMeta } from "@/lib/server/api/response";
import {
  admissionSourceFromUi,
  admissionSourceToUi,
  admissionStageFromUi,
  admissionStageToUi,
  admissionTypeFromUi,
  admissionTypeToUi,
  docVerificationToUi,
  genderFromUi,
  genderToUi,
  guardianRelationFromUi,
} from "@/lib/server/api/enums";
import { findOrCreateGuardian } from "@/lib/server/guardians/service";
import type { AdmissionStage, Prisma } from "@/lib/generated/prisma/client";

// --- Validation -------------------------------------------------------------

const nonEmpty = z.string().trim().min(1);
const optionalStr = z.string().trim().min(1).optional();
const dateStr = z.string().trim().refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date");
const genderUi = z.enum(["male", "female", "other", "prefer-not-to-say"]);
const admissionTypeUi = z.enum(["new", "transfer", "sibling", "staff-ward", "management-quota"]);
const sourceUi = z.enum(["website", "walk-in", "referral", "social-media", "education-fair", "agent", "phone-enquiry"]);
const stageUi = z.enum([
  "new-enquiry",
  "application-started",
  "documents-pending",
  "under-review",
  "interview-scheduled",
  "approved",
  "fee-pending",
  "enrolled",
  "rejected",
  "waitlisted",
]);

// Normalized applicant-guardian snapshot (stored in guardiansJson; materialized
// into real Guardian rows only on conversion).
const applicantGuardianSchema = z.object({
  firstName: nonEmpty.max(120),
  lastName: nonEmpty.max(120),
  email: z.string().trim().toLowerCase().email().optional(),
  phone: optionalStr,
  occupation: optionalStr,
  organization: optionalStr,
  addressLine1: optionalStr,
  addressLine2: optionalStr,
  city: optionalStr,
  state: optionalStr,
  country: optionalStr,
  postalCode: optionalStr,
  relation: z.enum(["father", "mother", "guardian"]).default("guardian"),
  isPrimary: z.boolean().optional(),
  isEmergencyContact: z.boolean().optional(),
  authorizedPickup: z.boolean().optional(),
});

export const admissionCreateSchema = z.object({
  firstName: nonEmpty.max(120),
  middleName: optionalStr,
  lastName: nonEmpty.max(120),
  preferredName: optionalStr,
  dateOfBirth: dateStr.optional(),
  gender: genderUi.default("prefer-not-to-say"),
  bloodGroup: optionalStr,
  nationality: optionalStr,
  religion: optionalStr,
  category: optionalStr,
  motherTongue: optionalStr,
  photoUrl: optionalStr,
  email: z.string().trim().toLowerCase().email().optional(),
  phone: optionalStr,
  appliedClass: optionalStr,
  appliedSectionPreference: optionalStr,
  admissionType: admissionTypeUi.default("new"),
  source: sourceUi.default("website"),
  priority: z.enum(["high", "medium", "low"]).default("medium"),
  draft: z.boolean().optional(),
  addressLine1: optionalStr,
  addressLine2: optionalStr,
  city: optionalStr,
  state: optionalStr,
  country: optionalStr,
  postalCode: optionalStr,
  guardians: z.array(applicantGuardianSchema).optional(),
  details: z.record(z.string(), z.unknown()).optional(),
  branchId: z.string().trim().min(1).optional(),
  academicSessionId: z.string().trim().min(1).optional(),
});

export const admissionUpdateSchema = admissionCreateSchema
  .omit({ branchId: true, academicSessionId: true })
  .partial();

export const stageChangeSchema = z.object({
  stage: stageUi,
  reason: optionalStr,
});

export const noteCreateSchema = z.object({
  body: nonEmpty.max(4000),
  pinned: z.boolean().optional(),
});

export const convertSchema = z.object({
  admissionNumber: optionalStr,
  classLabel: optionalStr,
  sectionLabel: optionalStr,
  rollNumber: optionalStr,
});

// --- Serializers ------------------------------------------------------------

type AppRow = Prisma.AdmissionApplicationGetPayload<object>;

export function serializeApplicationSummary(a: AppRow) {
  return {
    id: a.id,
    applicationNumber: a.applicationNumber,
    stage: admissionStageToUi[a.stage],
    draft: a.draft,
    priority: a.priority,
    source: admissionSourceToUi[a.source],
    admissionType: admissionTypeToUi[a.admissionType],
    appliedClass: a.appliedClass,
    appliedSectionPreference: a.appliedSectionPreference,
    applicantName: [a.firstName, a.middleName, a.lastName].filter(Boolean).join(" "),
    firstName: a.firstName,
    lastName: a.lastName,
    gender: genderToUi[a.gender],
    dateOfBirth: a.dateOfBirth ? a.dateOfBirth.toISOString().slice(0, 10) : null,
    email: a.email,
    phone: a.phone,
    branchId: a.branchId,
    academicSessionId: a.academicSessionId,
    assignedOfficerId: a.assignedOfficerId,
    assignedOfficerName: a.assignedOfficerName,
    convertedStudentId: a.convertedStudentId,
    submittedAt: a.submittedAt?.toISOString() ?? null,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

// --- Reads ------------------------------------------------------------------

export type AdmissionListParams = {
  page: number;
  pageSize: number;
  search?: string;
  stage?: string[];
  source?: string[];
  appliedClass?: string;
  branchId?: string;
  academicSessionId?: string;
  assignedOfficerId?: string;
};

export async function listApplications(scope: OrgScope, params: AdmissionListParams) {
  const where: Prisma.AdmissionApplicationWhereInput = { tenantId: scope.tenantId, schoolId: scope.schoolId };
  if (params.search) {
    const q = params.search.trim();
    where.OR = [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { applicationNumber: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }
  if (params.stage?.length) where.stage = { in: params.stage.map((s) => admissionStageFromUi[s]).filter(Boolean) };
  if (params.source?.length) where.source = { in: params.source.map((s) => admissionSourceFromUi[s]).filter(Boolean) };
  if (params.appliedClass) where.appliedClass = params.appliedClass;
  if (params.branchId) where.branchId = params.branchId;
  if (params.academicSessionId) where.academicSessionId = params.academicSessionId;
  if (params.assignedOfficerId) where.assignedOfficerId = params.assignedOfficerId;

  const [total, rows] = await Promise.all([
    prisma.admissionApplication.count({ where }),
    prisma.admissionApplication.findMany({
      where,
      orderBy: { createdAt: "desc" },
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
  return { data: rows.map(serializeApplicationSummary), meta };
}

export async function getApplicationDetail(scope: OrgScope, applicationId: string) {
  const a = await prisma.admissionApplication.findFirst({
    where: { id: applicationId, tenantId: scope.tenantId, schoolId: scope.schoolId },
    include: {
      stageHistory: { orderBy: { createdAt: "desc" } },
      notes: { orderBy: [{ pinned: "desc" }, { createdAt: "desc" }] },
      documents: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!a) throw new HttpError("NOT_FOUND", "Application not found");
  return {
    ...serializeApplicationSummary(a),
    address: {
      line1: a.addressLine1,
      line2: a.addressLine2,
      city: a.city,
      state: a.state,
      country: a.country,
      postalCode: a.postalCode,
    },
    guardians: (a.guardiansJson as unknown[] | null) ?? [],
    details: (a.detailsJson as Record<string, unknown> | null) ?? {},
    approvedAt: a.approvedAt?.toISOString() ?? null,
    rejectedAt: a.rejectedAt?.toISOString() ?? null,
    enrolledAt: a.enrolledAt?.toISOString() ?? null,
    stageHistory: a.stageHistory.map((h) => ({
      id: h.id,
      fromStage: h.fromStage ? admissionStageToUi[h.fromStage] : null,
      toStage: admissionStageToUi[h.toStage],
      changedByName: h.changedByName,
      reason: h.reason,
      createdAt: h.createdAt.toISOString(),
    })),
    notes: a.notes.map((n) => ({
      id: n.id,
      authorName: n.authorName,
      authorRole: n.authorRole,
      body: n.body,
      pinned: n.pinned,
      createdAt: n.createdAt.toISOString(),
    })),
    documents: a.documents.map((d) => ({
      id: d.id,
      type: d.type,
      displayName: d.displayName,
      status: d.status,
      verificationStatus: docVerificationToUi[d.verificationStatus],
      fileName: d.fileName,
      expiryDate: d.expiryDate ? d.expiryDate.toISOString().slice(0, 10) : null,
      notes: d.notes,
      createdAt: d.createdAt.toISOString(),
    })),
  };
}

// --- Application-number generation -----------------------------------------

async function nextApplicationNumber(
  db: Prisma.TransactionClient | typeof prisma,
  scope: OrgScope,
  sessionId: string,
): Promise<string> {
  const session = await db.academicSession.findUnique({ where: { id: sessionId }, select: { code: true } });
  const year = (session?.code ?? String(new Date().getFullYear())).split("-")[0];
  const count = await db.admissionApplication.count({ where: { schoolId: scope.schoolId, academicSessionId: sessionId } });
  // Deterministic-ish; the (schoolId, applicationNumber) unique constraint is the
  // real guard, with a short retry on the rare collision.
  for (let i = 0; i < 5; i++) {
    const candidate = `ADM-${year}-${1000 + count + i}`;
    const clash = await db.admissionApplication.findFirst({
      where: { schoolId: scope.schoolId, applicationNumber: candidate },
      select: { id: true },
    });
    if (!clash) return candidate;
  }
  return `ADM-${year}-${Date.now().toString().slice(-6)}`;
}

// --- Writes -----------------------------------------------------------------

export async function createApplication(scope: OrgScope, raw: unknown) {
  const input = parseInput(admissionCreateSchema, raw);
  const branchId = await resolveCreateBranch(scope, input.branchId);
  const academicSessionId = await resolveCreateSession(scope, input.academicSessionId);

  return prisma.$transaction(async (tx) => {
    const applicationNumber = await nextApplicationNumber(tx, scope, academicSessionId);
    const initialStage: AdmissionStage = input.draft ? "APPLICATION_STARTED" : "NEW_ENQUIRY";

    const app = await tx.admissionApplication.create({
      data: {
        tenantId: scope.tenantId,
        schoolId: scope.schoolId,
        branchId,
        academicSessionId,
        applicationNumber,
        draft: input.draft ?? false,
        stage: initialStage,
        priority: input.priority,
        source: admissionSourceFromUi[input.source],
        admissionType: admissionTypeFromUi[input.admissionType],
        appliedClass: input.appliedClass ?? null,
        appliedSectionPreference: input.appliedSectionPreference ?? null,
        firstName: input.firstName,
        middleName: input.middleName ?? null,
        lastName: input.lastName,
        preferredName: input.preferredName ?? null,
        dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
        gender: genderFromUi[input.gender],
        bloodGroup: input.bloodGroup ?? null,
        nationality: input.nationality ?? null,
        religion: input.religion ?? null,
        category: input.category ?? null,
        motherTongue: input.motherTongue ?? null,
        photoUrl: input.photoUrl ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        addressLine1: input.addressLine1 ?? null,
        addressLine2: input.addressLine2 ?? null,
        city: input.city ?? null,
        state: input.state ?? null,
        country: input.country ?? null,
        postalCode: input.postalCode ?? null,
        guardiansJson: input.guardians ? (input.guardians as Prisma.InputJsonValue) : undefined,
        detailsJson: input.details ? (input.details as Prisma.InputJsonValue) : undefined,
      },
    });
    await tx.admissionStageHistory.create({
      data: {
        applicationId: app.id,
        fromStage: null,
        toStage: initialStage,
        changedByUserId: scope.actor.id,
        changedByName: scope.actor.name,
        reason: "Application created",
      },
    });
    await recordAudit(tx, scope, "ADMISSION_CREATED", "AdmissionApplication", app.id, { applicationNumber });
    return serializeApplicationSummary(app);
  });
}

export async function updateApplication(scope: OrgScope, applicationId: string, raw: unknown) {
  const input = parseInput(admissionUpdateSchema, raw);
  const existing = await prisma.admissionApplication.findFirst({
    where: { id: applicationId, tenantId: scope.tenantId, schoolId: scope.schoolId },
    select: { id: true, stage: true },
  });
  if (!existing) throw new HttpError("NOT_FOUND", "Application not found");
  if (existing.stage === "ENROLLED") throw new HttpError("CONFLICT", "An enrolled application cannot be edited");

  const data: Prisma.AdmissionApplicationUpdateInput = {};
  const set = (k: string, v: unknown) => {
    (data as Record<string, unknown>)[k] = v;
  };
  if (input.firstName !== undefined) set("firstName", input.firstName);
  if (input.middleName !== undefined) set("middleName", input.middleName ?? null);
  if (input.lastName !== undefined) set("lastName", input.lastName);
  if (input.preferredName !== undefined) set("preferredName", input.preferredName ?? null);
  if (input.dateOfBirth !== undefined) set("dateOfBirth", input.dateOfBirth ? new Date(input.dateOfBirth) : null);
  if (input.gender !== undefined) set("gender", genderFromUi[input.gender]);
  if (input.bloodGroup !== undefined) set("bloodGroup", input.bloodGroup ?? null);
  if (input.nationality !== undefined) set("nationality", input.nationality ?? null);
  if (input.religion !== undefined) set("religion", input.religion ?? null);
  if (input.category !== undefined) set("category", input.category ?? null);
  if (input.motherTongue !== undefined) set("motherTongue", input.motherTongue ?? null);
  if (input.photoUrl !== undefined) set("photoUrl", input.photoUrl ?? null);
  if (input.email !== undefined) set("email", input.email ?? null);
  if (input.phone !== undefined) set("phone", input.phone ?? null);
  if (input.appliedClass !== undefined) set("appliedClass", input.appliedClass ?? null);
  if (input.appliedSectionPreference !== undefined) set("appliedSectionPreference", input.appliedSectionPreference ?? null);
  if (input.admissionType !== undefined) set("admissionType", admissionTypeFromUi[input.admissionType]);
  if (input.source !== undefined) set("source", admissionSourceFromUi[input.source]);
  if (input.priority !== undefined) set("priority", input.priority);
  if (input.addressLine1 !== undefined) set("addressLine1", input.addressLine1 ?? null);
  if (input.addressLine2 !== undefined) set("addressLine2", input.addressLine2 ?? null);
  if (input.city !== undefined) set("city", input.city ?? null);
  if (input.state !== undefined) set("state", input.state ?? null);
  if (input.country !== undefined) set("country", input.country ?? null);
  if (input.postalCode !== undefined) set("postalCode", input.postalCode ?? null);
  if (input.guardians !== undefined) set("guardiansJson", input.guardians as Prisma.InputJsonValue);
  if (input.details !== undefined) set("detailsJson", input.details as Prisma.InputJsonValue);

  const updated = await prisma.admissionApplication.update({ where: { id: applicationId }, data });
  await recordAudit(prisma, scope, "ADMISSION_UPDATED", "AdmissionApplication", applicationId);
  return serializeApplicationSummary(updated);
}

/** Enforced stage rules: ENROLLED is reachable only via convert; a converted
 *  application is frozen. Everything else is a permitted transition. */
function assertStageTransition(from: AdmissionStage, to: AdmissionStage): void {
  if (from === "ENROLLED") throw new HttpError("INVALID_STAGE_TRANSITION", "An enrolled application cannot change stage");
  if (to === "ENROLLED") throw new HttpError("INVALID_STAGE_TRANSITION", "Use conversion to enrol an application");
}

export async function changeStage(scope: OrgScope, applicationId: string, raw: unknown) {
  const input = parseInput(stageChangeSchema, raw);
  const toStage = admissionStageFromUi[input.stage];
  return prisma.$transaction(async (tx) => {
    const existing = await tx.admissionApplication.findFirst({
      where: { id: applicationId, tenantId: scope.tenantId, schoolId: scope.schoolId },
      select: { id: true, stage: true, submittedAt: true },
    });
    if (!existing) throw new HttpError("NOT_FOUND", "Application not found");
    assertStageTransition(existing.stage, toStage);

    const timestamps: Prisma.AdmissionApplicationUpdateInput = {};
    if (toStage === "APPROVED") timestamps.approvedAt = new Date();
    if (toStage === "REJECTED") timestamps.rejectedAt = new Date();
    // First forward move past enquiry/started marks submission.
    const submitStages: AdmissionStage[] = ["DOCUMENTS_PENDING", "UNDER_REVIEW", "INTERVIEW_SCHEDULED", "APPROVED", "FEE_PENDING"];
    if (!existing.submittedAt && submitStages.includes(toStage)) timestamps.submittedAt = new Date();

    const updated = await tx.admissionApplication.update({
      where: { id: applicationId },
      data: { stage: toStage, draft: false, ...timestamps },
    });
    await tx.admissionStageHistory.create({
      data: {
        applicationId,
        fromStage: existing.stage,
        toStage,
        changedByUserId: scope.actor.id,
        changedByName: scope.actor.name,
        reason: input.reason ?? null,
      },
    });
    const action = toStage === "APPROVED" ? "ADMISSION_APPROVED" : toStage === "REJECTED" ? "ADMISSION_REJECTED" : "ADMISSION_STAGE_CHANGED";
    await recordAudit(tx, scope, action, "AdmissionApplication", applicationId, { from: existing.stage, to: toStage });
    return serializeApplicationSummary(updated);
  });
}

export async function addApplicationNote(scope: OrgScope, applicationId: string, raw: unknown) {
  const input = parseInput(noteCreateSchema, raw);
  const app = await prisma.admissionApplication.findFirst({
    where: { id: applicationId, tenantId: scope.tenantId, schoolId: scope.schoolId },
    select: { id: true },
  });
  if (!app) throw new HttpError("NOT_FOUND", "Application not found");
  const note = await prisma.admissionNote.create({
    data: {
      applicationId,
      authorUserId: scope.actor.id,
      authorName: scope.actor.name ?? "Staff",
      body: input.body,
      pinned: input.pinned ?? false,
    },
  });
  return {
    id: note.id,
    authorName: note.authorName,
    authorRole: note.authorRole,
    body: note.body,
    pinned: note.pinned,
    createdAt: note.createdAt.toISOString(),
  };
}

// --- Conversion (critical transaction, spec §20) ---------------------------

const CONVERTIBLE_STAGES: AdmissionStage[] = ["APPROVED", "FEE_PENDING"];

export async function convertApplication(scope: OrgScope, applicationId: string, raw: unknown) {
  const input = parseInput(convertSchema, raw);

  return prisma.$transaction(async (tx) => {
    const app = await tx.admissionApplication.findFirst({
      where: { id: applicationId, tenantId: scope.tenantId, schoolId: scope.schoolId },
    });
    if (!app) throw new HttpError("NOT_FOUND", "Application not found");

    // Prevent duplicate conversion.
    if (app.stage === "ENROLLED" || app.convertedStudentId) {
      throw new HttpError("ALREADY_ENROLLED", "This application has already been converted to a student");
    }
    if (!CONVERTIBLE_STAGES.includes(app.stage)) {
      throw new HttpError("INVALID_STAGE_TRANSITION", "Only approved applications can be converted to a student");
    }
    if (!app.dateOfBirth) {
      throw new HttpError("VALIDATION_ERROR", "Applicant date of birth is required before conversion");
    }

    // Admission number: explicit (validated unique) or generated.
    let admissionNumber = input.admissionNumber?.trim();
    if (admissionNumber) {
      const clash = await tx.student.findFirst({
        where: { schoolId: scope.schoolId, admissionNumber },
        select: { id: true },
      });
      if (clash) throw new HttpError("DUPLICATE_ADMISSION_NUMBER", "Admission number already in use");
    } else {
      const year = String(new Date().getFullYear());
      const count = await tx.student.count({ where: { schoolId: scope.schoolId } });
      admissionNumber = `STU-${year}-${1000 + count}`;
      // Extremely unlikely to clash, but keep the invariant.
      const clash = await tx.student.findFirst({ where: { schoolId: scope.schoolId, admissionNumber }, select: { id: true } });
      if (clash) admissionNumber = `STU-${year}-${Date.now().toString().slice(-6)}`;
    }

    // Create the Student from the applicant snapshot.
    const student = await tx.student.create({
      data: {
        tenantId: scope.tenantId,
        schoolId: scope.schoolId,
        branchId: app.branchId,
        academicSessionId: app.academicSessionId,
        admissionNumber,
        rollNumber: input.rollNumber ?? null,
        firstName: app.firstName,
        middleName: app.middleName,
        lastName: app.lastName,
        preferredName: app.preferredName,
        dateOfBirth: app.dateOfBirth,
        gender: app.gender,
        bloodGroup: app.bloodGroup,
        nationality: app.nationality,
        religion: app.religion,
        category: app.category,
        motherTongue: app.motherTongue,
        photoUrl: app.photoUrl,
        email: app.email,
        phone: app.phone,
        classLabel: input.classLabel ?? app.appliedClass,
        sectionLabel: input.sectionLabel ?? app.appliedSectionPreference,
        admissionDate: new Date(),
        admissionType: app.admissionType,
        status: "ACTIVE",
        addressLine1: app.addressLine1,
        addressLine2: app.addressLine2,
        city: app.city,
        state: app.state,
        country: app.country,
        postalCode: app.postalCode,
        sourceApplicationId: app.id,
      },
    });

    // Materialize + link guardians from the applicant snapshot.
    const guardians = applicantGuardianSchema.array().safeParse(app.guardiansJson ?? []);
    if (guardians.success) {
      let primaryAssigned = false;
      for (const g of guardians.data) {
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
          },
        });
      }
    }

    // Transfer admission document metadata → student document metadata.
    const appDocs = await tx.admissionDocument.findMany({ where: { applicationId: app.id } });
    if (appDocs.length) {
      await tx.studentDocument.createMany({
        data: appDocs.map((d) => ({
          studentId: student.id,
          type: d.type,
          displayName: d.displayName,
          status: d.status,
          verificationStatus: d.verificationStatus,
          fileName: d.fileName,
          expiryDate: d.expiryDate,
          notes: d.notes,
        })),
      });
    }

    // Timeline events on the new student.
    await tx.studentTimelineEvent.createMany({
      data: [
        { studentId: student.id, type: "ADMITTED", title: "Student admitted", category: "system", actorUserId: scope.actor.id, actorName: scope.actor.name },
        {
          studentId: student.id,
          type: "ADMISSION_CONVERTED",
          title: `Converted from application ${app.applicationNumber}`,
          detail: app.applicationNumber,
          category: "admission",
          actorUserId: scope.actor.id,
          actorName: scope.actor.name,
        },
      ],
    });

    // Mark the application ENROLLED (preserving stage history).
    await tx.admissionApplication.update({
      where: { id: app.id },
      data: { stage: "ENROLLED", enrolledAt: new Date(), convertedStudentId: student.id },
    });
    await tx.admissionStageHistory.create({
      data: {
        applicationId: app.id,
        fromStage: app.stage,
        toStage: "ENROLLED",
        changedByUserId: scope.actor.id,
        changedByName: scope.actor.name,
        reason: "Converted to student",
      },
    });

    await recordAudit(tx, scope, "ADMISSION_CONVERTED", "AdmissionApplication", app.id, { studentId: student.id, admissionNumber });
    await recordAudit(tx, scope, "STUDENT_CREATED", "Student", student.id, { fromApplication: app.id });

    return { studentId: student.id, admissionNumber, applicationId: app.id };
  });
}
