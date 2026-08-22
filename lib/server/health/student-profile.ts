// Student 360 Health tab (Phase 9R) — real profile + visit history, redacted
// per caller's health.viewSensitive (resolved once at the route layer).
// Emergency contacts are derived live from real StudentGuardian.
// isEmergencyContact + Guardian records — never duplicated into a
// health-domain field.
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import type { OrgScope } from "@/lib/server/api/scope";
import type { StudentHealthProfileDto } from "@/lib/api/contracts";
import { staffDisplayName } from "./access";
import { getHealthProfileFor } from "./profile";
import { listVisits } from "./visits";

export async function getStudentHealthProfile(scope: OrgScope, studentId: string, sensitive: boolean): Promise<StudentHealthProfileDto> {
  const student = await prisma.student.findFirst({ where: { id: studentId, schoolId: scope.schoolId }, select: { id: true } });
  if (!student) throw new HttpError("NOT_FOUND", "Student not found");

  const [profile, openVisits, recent, medications, contacts] = await Promise.all([
    getHealthProfileFor(scope, { studentId }),
    listVisits(scope, sensitive, { studentId, status: "open", pageSize: 1 }),
    listVisits(scope, sensitive, { studentId, pageSize: 10 }),
    sensitive
      ? prisma.healthMedicationAdministration.findMany({
          where: { visit: { studentId } },
          orderBy: { administeredAt: "desc" },
          take: 20,
          include: { administeredBy: { select: { firstName: true, lastName: true, displayName: true } } },
        })
      : Promise.resolve([]),
    prisma.studentGuardian.findMany({
      where: { studentId, isEmergencyContact: true },
      select: { relation: true, guardian: { select: { firstName: true, lastName: true, phone: true } } },
    }),
  ]);

  return {
    profile,
    openVisit: openVisits.items[0] ?? null,
    recentVisits: recent.items,
    medicationHistory: medications.map((m) => ({
      id: m.id, medicationName: m.medicationName, quantity: m.quantity, unit: m.unit, notes: m.notes,
      administeredByStaffId: m.administeredByStaffId,
      administeredByStaffName: m.administeredBy ? staffDisplayName(m.administeredBy) : null,
      administeredAt: m.administeredAt.toISOString(),
    })),
    emergencyContacts: contacts.map((c) => ({ name: `${c.guardian.firstName} ${c.guardian.lastName}`.trim(), phone: c.guardian.phone, relation: c.relation.toLowerCase() })),
  };
}
