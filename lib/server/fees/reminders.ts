// Fee Reminders (Phase 9F) — HONEST preview only. Student and Guardian have
// no real linked User account in this system (see the Notification schema
// doc comment), so there is no real in-app recipient to fan out to, and this
// repo has no SMS/WhatsApp/email provider integration. Every candidate here
// is therefore explicitly `deliverable: false` — a queue/preview the school
// can act on manually (e.g. phone the guardian), never a simulated send.
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import type { OrgScope } from "@/lib/server/api/scope";
import type { FeeReminderCandidateDto } from "@/lib/api/contracts";
import { computeCharge } from "./balance";

function requireSession(scope: OrgScope): string {
  if (!scope.academicSessionId) throw new HttpError("INVALID_SESSION", "Select an academic session first");
  return scope.academicSessionId;
}

export async function listFeeReminderCandidates(scope: OrgScope): Promise<FeeReminderCandidateDto[]> {
  const sessionId = requireSession(scope);
  const charges = await prisma.feeCharge.findMany({
    where: { schoolId: scope.schoolId, academicSessionId: sessionId, student: { status: "ACTIVE" } },
    select: {
      studentId: true, amount: true, dueDate: true, adjustments: { select: { kind: true, computedAmount: true } }, allocations: { select: { amount: true } },
      student: {
        select: {
          firstName: true, lastName: true, admissionNumber: true,
          guardians: { where: { isPrimary: true }, take: 1, select: { guardian: { select: { firstName: true, lastName: true, phone: true } } } },
        },
      },
    },
  });

  const today = new Date();
  const byStudent = new Map<string, { name: string; admissionNumber: string; overdueAmount: number; oldestOverdueDays: number; guardianName: string | null; guardianPhone: string | null }>();
  for (const c of charges) {
    const calc = computeCharge(c);
    if (calc.status !== "overdue") continue;
    const g = c.student.guardians[0]?.guardian;
    const key = c.studentId;
    const row = byStudent.get(key) ?? { name: `${c.student.firstName} ${c.student.lastName}`, admissionNumber: c.student.admissionNumber, overdueAmount: 0, oldestOverdueDays: 0, guardianName: g ? `${g.firstName} ${g.lastName}` : null, guardianPhone: g?.phone ?? null };
    row.overdueAmount += calc.balance;
    row.oldestOverdueDays = Math.max(row.oldestOverdueDays, Math.floor((today.getTime() - c.dueDate.getTime()) / 86_400_000));
    byStudent.set(key, row);
  }

  return [...byStudent.entries()]
    .map(([studentId, r]) => ({ studentId, studentName: r.name, admissionNumber: r.admissionNumber, overdueAmount: Math.round(r.overdueAmount * 100) / 100, oldestOverdueDays: r.oldestOverdueDays, guardianName: r.guardianName, guardianPhone: r.guardianPhone, deliverable: false as const }))
    .sort((a, b) => b.oldestOverdueDays - a.oldestOverdueDays);
}
