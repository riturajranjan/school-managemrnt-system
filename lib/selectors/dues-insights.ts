import type { Db } from "@/lib/data/store";
import type { StudentFeeItem } from "@/lib/types/fees";
import { addMoney, sumMoney, zeroMoney, type Money } from "@/lib/finance/money";
import { outstandingForItem, totalOutstanding, totalOverdue } from "./fee-item-insights";

export type AgingBucketKey = "not-overdue" | "1-15" | "16-30" | "31-60" | "61-90" | "90-plus";

export const agingBucketLabels: Record<AgingBucketKey, string> = {
  "not-overdue": "Not overdue",
  "1-15": "1–15 days",
  "16-30": "16–30 days",
  "31-60": "31–60 days",
  "61-90": "61–90 days",
  "90-plus": "More than 90 days",
};

export function daysOverdue(item: StudentFeeItem, today = new Date()): number {
  const due = new Date(item.dueDate);
  const diff = Math.floor((today.getTime() - due.getTime()) / (24 * 60 * 60 * 1000));
  return Math.max(diff, 0);
}

export function agingBucketFor(item: StudentFeeItem, today = new Date()): AgingBucketKey {
  if (item.status !== "overdue") return "not-overdue";
  const days = daysOverdue(item, today);
  if (days <= 15) return "1-15";
  if (days <= 30) return "16-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90-plus";
}

export type AgingBucketRow = { bucket: AgingBucketKey; count: number; amount: Money };

export function computeAgingBuckets(items: StudentFeeItem[], currency: StudentFeeItem["billedAmount"]["currency"] = "INR", today = new Date()): AgingBucketRow[] {
  const overdueItems = items.filter((i) => i.status === "overdue");
  const buckets: AgingBucketKey[] = ["1-15", "16-30", "31-60", "61-90", "90-plus"];
  return buckets.map((bucket) => {
    const matching = overdueItems.filter((i) => agingBucketFor(i, today) === bucket);
    return { bucket, count: matching.length, amount: sumMoney(matching.map((i) => outstandingForItem(i)), currency) };
  });
}

export type StudentDuesRow = {
  studentId: string;
  outstanding: Money;
  overdue: Money;
  oldestOverdueDays: number;
  itemCount: number;
  hasTransport: boolean;
  hasScholarship: boolean;
};

export function computeStudentDuesRows(db: Db, today = new Date()): StudentDuesRow[] {
  const byStudent = new Map<string, StudentFeeItem[]>();
  for (const item of db.studentFeeItems) {
    if (item.status === "cancelled") continue;
    if (!byStudent.has(item.studentId)) byStudent.set(item.studentId, []);
    byStudent.get(item.studentId)!.push(item);
  }

  const rows: StudentDuesRow[] = [];
  for (const [studentId, items] of byStudent) {
    const outstanding = totalOutstanding(items);
    if (outstanding.minorUnits <= 0) continue;
    const overdue = totalOverdue(items);
    const overdueItems = items.filter((i) => i.status === "overdue");
    const oldestOverdueDays = overdueItems.reduce((max, i) => Math.max(max, daysOverdue(i, today)), 0);
    rows.push({
      studentId,
      outstanding,
      overdue,
      oldestOverdueDays,
      itemCount: items.length,
      hasTransport: items.some((i) => i.componentType === "transport"),
      hasScholarship: db.scholarships.some((s) => s.studentId === studentId && s.status === "active"),
    });
  }
  return rows.sort((a, b) => b.overdue.minorUnits - a.overdue.minorUnits);
}

export type DuesMetrics = {
  totalOutstanding: Money;
  totalOverdue: Money;
  dueThisWeek: Money;
  dueThisMonth: Money;
  studentsOverdue: number;
  familiesWithMultipleOverdue: number;
  collectionRiskAmount: Money;
  averageOverdueAgeDays: number;
};

export function computeDuesMetrics(db: Db, today = new Date()): DuesMetrics {
  const activeItems = db.studentFeeItems.filter((i) => i.status !== "cancelled");
  const weekEnd = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const monthEnd = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

  const dueThisWeekItems = activeItems.filter((i) => (i.status === "pending" || i.status === "partial") && new Date(i.dueDate) <= weekEnd && new Date(i.dueDate) >= today);
  const dueThisMonthItems = activeItems.filter((i) => (i.status === "pending" || i.status === "partial") && new Date(i.dueDate) <= monthEnd && new Date(i.dueDate) >= today);

  const overdueItems = activeItems.filter((i) => i.status === "overdue");
  const studentsOverdueIds = new Set(overdueItems.map((i) => i.studentId));

  const overdueByStudentClass = new Map<string, Set<string>>(); // guardian-ish grouping by primaryGuardianId
  for (const item of overdueItems) {
    const student = db.students.find((s) => s.id === item.studentId);
    if (!student) continue;
    const key = student.primaryGuardianId;
    if (!overdueByStudentClass.has(key)) overdueByStudentClass.set(key, new Set());
    overdueByStudentClass.get(key)!.add(item.studentId);
  }
  const familiesWithMultipleOverdue = [...overdueByStudentClass.values()].filter((set) => set.size > 1).length;

  const riskItems = overdueItems.filter((i) => daysOverdue(i, today) > 30);
  const totalDays = overdueItems.reduce((sum, i) => sum + daysOverdue(i, today), 0);

  return {
    totalOutstanding: totalOutstanding(activeItems),
    totalOverdue: totalOverdue(activeItems),
    dueThisWeek: sumMoney(dueThisWeekItems.map((i) => outstandingForItem(i)), "INR"),
    dueThisMonth: sumMoney(dueThisMonthItems.map((i) => outstandingForItem(i)), "INR"),
    studentsOverdue: studentsOverdueIds.size,
    familiesWithMultipleOverdue,
    collectionRiskAmount: sumMoney(riskItems.map((i) => outstandingForItem(i)), "INR"),
    averageOverdueAgeDays: overdueItems.length === 0 ? 0 : Math.round(totalDays / overdueItems.length),
  };
}

export type ClassOverdueRow = { classId: string; amount: Money; studentCount: number };

export function computeHighestOverdueClasses(db: Db, limit = 5): ClassOverdueRow[] {
  const byClass = new Map<string, { amount: Money; studentIds: Set<string> }>();
  for (const item of db.studentFeeItems) {
    if (item.status !== "overdue") continue;
    const student = db.students.find((s) => s.id === item.studentId);
    if (!student) continue;
    const entry = byClass.get(student.classId) ?? { amount: zeroMoney("INR"), studentIds: new Set<string>() };
    entry.amount = addMoney(entry.amount, outstandingForItem(item));
    entry.studentIds.add(student.id);
    byClass.set(student.classId, entry);
  }
  return [...byClass.entries()]
    .map(([classId, v]) => ({ classId, amount: v.amount, studentCount: v.studentIds.size }))
    .sort((a, b) => b.amount.minorUnits - a.amount.minorUnits)
    .slice(0, limit);
}
