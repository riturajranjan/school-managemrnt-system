// Dues, Overdue & the Student Fee Ledger (Phase 9F) — every number here reads
// through computeCharge() (lib/server/fees/balance.ts), the same formula
// Collection/Reports/Dashboard use. Nothing is persisted; a charge's status
// is always derived live so it can never drift from the ledger. Bulk queries
// (one FeeCharge findMany with nested adjustments/allocations/student,
// grouped in JS) — never one query per student.
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { DuesAgingBucketDto, DuesSummaryDto, FeeChargeDto, StudentDuesRowDto, StudentFeeLedgerDto } from "@/lib/api/contracts";
import { computeCharge } from "./balance";
import { paymentSelect, paymentToDto } from "./payments";

function requireSession(scope: OrgScope): string {
  if (!scope.academicSessionId) throw new HttpError("INVALID_SESSION", "Select an academic session first");
  return scope.academicSessionId;
}

const chargeWithCalc = { id: true, categoryName: true, itemName: true, amount: true, dueDate: true, adjustments: { select: { kind: true, computedAmount: true } }, allocations: { select: { amount: true } } } satisfies Prisma.FeeChargeSelect;
type ChargeRow = Prisma.FeeChargeGetPayload<{ select: typeof chargeWithCalc }>;

function chargeDto(c: ChargeRow, studentId: string): FeeChargeDto {
  const calc = computeCharge(c);
  return {
    id: c.id, studentId, categoryName: c.categoryName, itemName: c.itemName, dueDate: c.dueDate.toISOString().slice(0, 10),
    billedAmount: calc.billedAmount, discountAmount: calc.discountAmount, scholarshipAmount: calc.scholarshipAmount, lateFeeAmount: calc.lateFeeAmount,
    netAmount: calc.netAmount, paidAmount: calc.paidAmount, balance: calc.balance, status: calc.status,
  };
}

export async function getStudentFeeLedger(scope: OrgScope, studentId: string): Promise<StudentFeeLedgerDto> {
  const student = await prisma.student.findFirst({ where: { id: studentId, schoolId: scope.schoolId }, select: { id: true } });
  if (!student) throw new HttpError("NOT_FOUND", "Student not found");

  const [assignments, charges, payments] = await Promise.all([
    prisma.studentFeeAssignment.findMany({ where: { studentId, schoolId: scope.schoolId }, orderBy: { assignedAt: "desc" }, select: { id: true, feeStructureId: true, feeStructure: { select: { name: true } }, status: true, assignedAt: true } }),
    prisma.feeCharge.findMany({ where: { studentId, schoolId: scope.schoolId }, orderBy: { dueDate: "asc" }, select: chargeWithCalc }),
    prisma.feePayment.findMany({ where: { studentId, schoolId: scope.schoolId }, orderBy: { createdAt: "desc" }, select: paymentSelect }),
  ]);

  const chargeDtos = charges.map((c) => chargeDto(c, studentId));
  const totals = chargeDtos.reduce(
    (t, c) => ({ billed: t.billed + c.billedAmount, adjustments: t.adjustments + c.discountAmount + c.scholarshipAmount - c.lateFeeAmount, paid: t.paid + c.paidAmount, balance: t.balance + c.balance }),
    { billed: 0, adjustments: 0, paid: 0, balance: 0 },
  );

  return {
    studentId,
    assignments: assignments.map((a) => ({ id: a.id, feeStructureId: a.feeStructureId, feeStructureName: a.feeStructure.name, status: a.status === "ACTIVE" ? "active" : "withdrawn", assignedAt: a.assignedAt.toISOString() })),
    charges: chargeDtos,
    payments: payments.map(paymentToDto),
    totals,
  };
}

const duesQuerySchema = z.object({ classId: z.string().optional(), sectionId: z.string().optional(), search: z.string().optional() });

export async function listStudentDues(scope: OrgScope, raw: unknown): Promise<StudentDuesRowDto[]> {
  const input = parseInput(duesQuerySchema, raw);
  const sessionId = requireSession(scope);

  const charges = await prisma.feeCharge.findMany({
    where: {
      schoolId: scope.schoolId, academicSessionId: sessionId,
      student: {
        status: "ACTIVE",
        ...(input.search ? { OR: [{ firstName: { contains: input.search, mode: "insensitive" } }, { lastName: { contains: input.search, mode: "insensitive" } }, { admissionNumber: { contains: input.search, mode: "insensitive" } }] } : {}),
        ...(input.classId || input.sectionId ? { enrollments: { some: { academicSessionId: sessionId, status: "ENROLLED", ...(input.classId ? { classId: input.classId } : {}), ...(input.sectionId ? { sectionId: input.sectionId } : {}) } } } : {}),
      },
    },
    select: {
      ...chargeWithCalc,
      studentId: true,
      student: { select: { firstName: true, lastName: true, admissionNumber: true, enrollments: { where: { academicSessionId: sessionId, status: "ENROLLED" }, take: 1, select: { class: { select: { name: true } }, section: { select: { name: true } } } } } },
    },
  });

  const byStudent = new Map<string, { name: string; admissionNumber: string; className: string | null; sectionName: string | null; outstanding: number; overdue: number; oldestOverdueDays: number }>();
  const today = new Date();
  for (const c of charges) {
    const calc = computeCharge(c);
    if (calc.balance <= 0) continue;
    const enrollment = c.student.enrollments[0];
    const key = c.studentId;
    const row = byStudent.get(key) ?? { name: `${c.student.firstName} ${c.student.lastName}`, admissionNumber: c.student.admissionNumber, className: enrollment?.class.name ?? null, sectionName: enrollment?.section.name ?? null, outstanding: 0, overdue: 0, oldestOverdueDays: 0 };
    row.outstanding += calc.balance;
    if (calc.status === "overdue") {
      row.overdue += calc.balance;
      const days = Math.floor((today.getTime() - c.dueDate.getTime()) / 86_400_000);
      row.oldestOverdueDays = Math.max(row.oldestOverdueDays, days);
    }
    byStudent.set(key, row);
  }

  return [...byStudent.entries()].map(([studentId, r]) => ({ studentId, studentName: r.name, admissionNumber: r.admissionNumber, className: r.className, sectionName: r.sectionName, outstanding: Math.round(r.outstanding * 100) / 100, overdue: Math.round(r.overdue * 100) / 100, oldestOverdueDays: r.oldestOverdueDays }));
}

function agingBucketFor(days: number): DuesAgingBucketDto["bucket"] {
  if (days <= 0) return "current";
  if (days <= 15) return "1-15";
  if (days <= 30) return "16-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90-plus";
}

export async function getDuesSummary(scope: OrgScope): Promise<DuesSummaryDto> {
  const sessionId = requireSession(scope);
  const charges = await prisma.feeCharge.findMany({
    where: { schoolId: scope.schoolId, academicSessionId: sessionId, student: { status: "ACTIVE" } },
    select: { ...chargeWithCalc, studentId: true },
  });

  const today = new Date();
  const weekAhead = new Date(today.getTime() + 7 * 86_400_000);
  const monthAhead = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());

  let totalOutstanding = 0, totalOverdue = 0, dueThisWeek = 0, dueThisMonth = 0;
  const overdueStudents = new Set<string>();
  const buckets = new Map<DuesAgingBucketDto["bucket"], { amount: number; count: number }>();

  for (const c of charges) {
    const calc = computeCharge(c);
    if (calc.balance <= 0) continue;
    totalOutstanding += calc.balance;
    if (calc.status === "overdue") {
      totalOverdue += calc.balance;
      const days = Math.floor((today.getTime() - c.dueDate.getTime()) / 86_400_000);
      const bucket = agingBucketFor(days);
      const b = buckets.get(bucket) ?? { amount: 0, count: 0 };
      b.amount += calc.balance;
      b.count += 1;
      buckets.set(bucket, b);
      overdueStudents.add(c.studentId);
    } else if (c.dueDate <= weekAhead) dueThisWeek += calc.balance;
    if (c.dueDate <= monthAhead && c.dueDate >= today) dueThisMonth += calc.balance;
  }

  const aging: DuesAgingBucketDto[] = (["current", "1-15", "16-30", "31-60", "61-90", "90-plus"] as const)
    .filter((b) => b !== "current")
    .map((bucket) => ({ bucket, amount: Math.round((buckets.get(bucket)?.amount ?? 0) * 100) / 100, count: buckets.get(bucket)?.count ?? 0 }));

  return {
    totalOutstanding: Math.round(totalOutstanding * 100) / 100, totalOverdue: Math.round(totalOverdue * 100) / 100,
    dueThisWeek: Math.round(dueThisWeek * 100) / 100, dueThisMonth: Math.round(dueThisMonth * 100) / 100,
    studentsOverdue: overdueStudents.size, aging,
  };
}
