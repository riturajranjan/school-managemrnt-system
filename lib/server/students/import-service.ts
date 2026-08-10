// Student bulk-import service (Backend Phase 4.1). All-or-nothing: the whole
// upload is validated (Zod per row + in-file and in-DB duplicate admission
// numbers) BEFORE any write; if anything is invalid, zero rows are created and
// row-level details are returned. A valid batch is created in a single Prisma
// transaction (student + ADMITTED timeline + audit + optional guardian link),
// with org scope assigned from the validated server context — CSV/client
// ownership fields are never trusted.
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { resolveCreateBranch, resolveCreateSession, type OrgScope } from "@/lib/server/api/scope";
import { admissionTypeFromUi, genderFromUi, guardianRelationFromUi } from "@/lib/server/api/enums";
import { findOrCreateGuardian } from "@/lib/server/guardians/service";

// Synchronous batch cap. Chosen for a single interactive Prisma transaction on a
// per-row create loop (no background workers yet); comfortably completes within
// the raised 60s transaction budget. Larger imports should move to a job queue
// in a later phase.
export const MAX_IMPORT_ROWS = 500;

const optionalStr = z.string().trim().min(1).optional();
const dateStr = z.string().trim().refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date — use YYYY-MM-DD");

const importGuardianSchema = z
  .object({
    firstName: z.string().trim().min(1).max(120),
    lastName: z.string().trim().min(1).max(120),
    phone: optionalStr,
    email: z.string().trim().toLowerCase().email("Invalid guardian email").optional(),
    relation: z.enum(["father", "mother", "guardian"]).default("guardian"),
  })
  .optional();

export const importRowSchema = z.object({
  admissionNumber: z.string().trim().min(1).max(60).optional(),
  firstName: z.string().trim().min(1, "firstName is required").max(120),
  middleName: optionalStr,
  lastName: z.string().trim().min(1, "lastName is required").max(120),
  dateOfBirth: dateStr,
  gender: z.enum(["male", "female", "other", "prefer-not-to-say"]).default("prefer-not-to-say"),
  classLabel: optionalStr,
  sectionLabel: optionalStr,
  rollNumber: optionalStr,
  bloodGroup: optionalStr,
  nationality: optionalStr,
  religion: optionalStr,
  category: optionalStr,
  admissionType: z.enum(["new", "transfer", "sibling", "staff-ward", "management-quota"]).default("new"),
  guardian: importGuardianSchema,
});

type ImportRow = z.infer<typeof importRowSchema>;
export type ImportDetail = { row: number; field?: string; message: string };
export type ImportResult =
  | { ok: true; imported: number; failed: number; studentIds: string[] }
  | { ok: false; details: ImportDetail[] };

export async function importStudents(scope: OrgScope, raw: unknown): Promise<ImportResult> {
  const top = z.object({ students: z.array(z.unknown()) }).safeParse(raw);
  if (!top.success || top.data.students.length === 0) {
    throw new HttpError("VALIDATION_ERROR", "A non-empty students array is required");
  }
  const rows = top.data.students;
  if (rows.length > MAX_IMPORT_ROWS) {
    throw new HttpError("TOO_MANY_ROWS", `Import is limited to ${MAX_IMPORT_ROWS} rows per file (received ${rows.length})`);
  }

  const details: ImportDetail[] = [];
  // Row numbers are 1-based positions in the submitted array.
  const parsed = rows.map((r, i) => ({ row: i + 1, result: importRowSchema.safeParse(r) }));

  for (const { row, result } of parsed) {
    if (!result.success) {
      for (const issue of result.error.issues) {
        details.push({ row, field: issue.path.join(".") || undefined, message: issue.message });
      }
    }
  }

  // In-file duplicate admission numbers.
  const seen = new Map<string, number>();
  for (const { row, result } of parsed) {
    if (result.success && result.data.admissionNumber) {
      const key = result.data.admissionNumber.toLowerCase();
      if (seen.has(key)) details.push({ row, field: "admissionNumber", message: `Duplicate admission number "${result.data.admissionNumber}" within the file` });
      else seen.set(key, row);
    }
  }

  // In-DB duplicate admission numbers (within this school).
  const providedNumbers = parsed
    .filter((p) => p.result.success && p.result.data.admissionNumber)
    .map((p) => (p.result as { success: true; data: ImportRow }).data.admissionNumber as string);
  if (providedNumbers.length) {
    const existing = await prisma.student.findMany({
      where: { schoolId: scope.schoolId, admissionNumber: { in: providedNumbers } },
      select: { admissionNumber: true },
    });
    const existingSet = new Set(existing.map((e) => e.admissionNumber.toLowerCase()));
    for (const { row, result } of parsed) {
      if (result.success && result.data.admissionNumber && existingSet.has(result.data.admissionNumber.toLowerCase())) {
        details.push({ row, field: "admissionNumber", message: `Admission number "${result.data.admissionNumber}" already exists in this school` });
      }
    }
  }

  if (details.length > 0) {
    details.sort((a, b) => a.row - b.row);
    return { ok: false, details };
  }

  // Everything valid → resolve scope once and create all rows atomically.
  const validRows = parsed.map((p) => (p.result as { success: true; data: ImportRow }).data);
  const branchId = await resolveCreateBranch(scope);
  const academicSessionId = await resolveCreateSession(scope);

  // Pre-compute unique admission numbers for rows that didn't supply one.
  const taken = new Set<string>();
  for (const r of validRows) if (r.admissionNumber) taken.add(r.admissionNumber.toLowerCase());
  const dbCount = await prisma.student.count({ where: { schoolId: scope.schoolId } });
  const year = String(new Date().getFullYear());
  let seq = dbCount;
  function nextAdmissionNumber(): string {
    for (;;) {
      seq += 1;
      const candidate = `STU-${year}-${1000 + seq}`;
      if (!taken.has(candidate.toLowerCase())) {
        taken.add(candidate.toLowerCase());
        return candidate;
      }
    }
  }
  const resolvedNumbers = validRows.map((r) => r.admissionNumber ?? nextAdmissionNumber());

  const studentIds = await prisma.$transaction(
    async (tx) => {
      const ids: string[] = [];
      for (let i = 0; i < validRows.length; i++) {
        const r = validRows[i];
        const student = await tx.student.create({
          data: {
            tenantId: scope.tenantId,
            schoolId: scope.schoolId,
            branchId,
            academicSessionId,
            admissionNumber: resolvedNumbers[i],
            rollNumber: r.rollNumber ?? null,
            firstName: r.firstName,
            middleName: r.middleName ?? null,
            lastName: r.lastName,
            dateOfBirth: new Date(r.dateOfBirth),
            gender: genderFromUi[r.gender],
            bloodGroup: r.bloodGroup ?? null,
            nationality: r.nationality ?? null,
            religion: r.religion ?? null,
            category: r.category ?? null,
            classLabel: r.classLabel ?? null,
            sectionLabel: r.sectionLabel ?? null,
            admissionDate: new Date(),
            admissionType: admissionTypeFromUi[r.admissionType],
            status: "ACTIVE",
          },
          select: { id: true },
        });
        ids.push(student.id);

        if (r.guardian) {
          const { id: guardianId } = await findOrCreateGuardian(tx, scope, {
            firstName: r.guardian.firstName,
            lastName: r.guardian.lastName,
            phone: r.guardian.phone,
            email: r.guardian.email,
          });
          await tx.studentGuardian.upsert({
            where: { studentId_guardianId: { studentId: student.id, guardianId } },
            update: {},
            create: {
              studentId: student.id,
              guardianId,
              relation: guardianRelationFromUi[r.guardian.relation],
              isPrimary: true,
              isEmergencyContact: true,
              authorizedPickup: true,
              isFeeResponsible: true,
            },
          });
        }

        await tx.studentTimelineEvent.create({
          data: {
            studentId: student.id,
            type: "ADMITTED",
            title: "Imported via CSV import",
            category: "system",
            actorUserId: scope.actor.id,
            actorName: scope.actor.name,
          },
        });
        await recordAudit(tx, scope, "STUDENT_CREATED", "Student", student.id, { source: "import" });
      }
      // One summary audit event for the batch.
      await recordAudit(tx, scope, "STUDENT_CREATED", "StudentImport", ids[0] ?? "batch", {
        source: "import",
        imported: ids.length,
      });
      return ids;
    },
    { timeout: 60_000, maxWait: 10_000 },
  );

  return { ok: true, imported: studentIds.length, failed: 0, studentIds };
}
