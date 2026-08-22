// Action Inbox (Phase 9L) — a pure aggregation/read layer. NOT a workflow
// engine: no ActionItem table, no second status field, no persisted rows.
// Every item is computed live, on each request, from an existing real
// domain's own status/lifecycle — the source domain remains the sole
// authority. Resolving the source state (approve leave, finalize payroll,
// etc.) via that domain's own real API is what makes the derived item
// disappear on the next fetch; there is no separate "complete" action here.
//
// `id` is deterministic (`<sourceType>:<sourceId>:<actionKind>`), never
// randomly generated, so the same real action always maps to the same id
// across requests. Priority/dueAt are only ever set from a real domain
// field — never fabricated, never an invented SLA/timeout.
//
// Visibility mirrors each domain's own authorization rule exactly (the same
// exported isBroadXManager() role checks its own mutation routes use) rather
// than a single broad "action-inbox.manage" permission — RBAC access to the
// underlying action must always match RBAC access to actually perform it.
import { prisma } from "@/lib/db/prisma";
import { getCurrentStaffProfile } from "@/lib/server/staff/service";
import { listLessonPlans, isBroadLessonPlanManager } from "@/lib/server/lesson-plans/service";
import { listLeaveRequests, isBroadLeaveManager } from "@/lib/server/leave/service";
import { listMarksSummary, isBroadMarksManager } from "@/lib/server/exams/marks-service";
import { getFeeReconciliationReport } from "@/lib/server/fees/reports";
import { isBroadFeeManager } from "@/lib/server/fees/access";
import { listPayrollRuns } from "@/lib/server/payroll/runs";
import { isBroadPayrollManager } from "@/lib/server/payroll/access";
import { listVisits } from "@/lib/server/visitors/visits";
import { isBroadVisitorManager } from "@/lib/server/visitors/access";
import { getUnreadCount } from "@/lib/server/communication/service";
import { listLoans } from "@/lib/server/library/loans";
import { isBroadLibraryManager } from "@/lib/server/library/access";
import { getInventoryDashboard } from "@/lib/server/inventory/dashboard";
import { isBroadInventoryManager } from "@/lib/server/inventory/access";
import type { OrgScope } from "@/lib/server/api/scope";
import type { ActionCategoryDto, ActionInboxSummaryDto, ActionItemDto, ActionPriorityDto } from "@/lib/api/contracts";

export type ActionInboxPermFlags = { communication: boolean };

const CATEGORIES: ActionCategoryDto[] = ["lesson_plan", "leave", "marks", "fees", "payroll", "visitor", "communication", "library", "inventory"];
const PRIORITIES: ActionPriorityDto[] = ["urgent", "high", "normal", "low"];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
function isOnOrBefore(dateIso: string, cutoffIso: string): boolean {
  return dateIso <= cutoffIso;
}

async function lessonPlanActions(scope: OrgScope): Promise<ActionItemDto[]> {
  if (!(await isBroadLessonPlanManager(scope))) return [];
  const { data } = await listLessonPlans(scope, { status: "submitted", pageSize: 100 });
  const today = todayIso();
  return data.map((p) => ({
    id: `LESSON_PLAN:${p.id}:REVIEW`,
    sourceType: "LessonPlan", sourceId: p.id,
    category: "lesson_plan", title: `Review lesson plan: ${p.subject.name} — ${p.section.className}-${p.section.name}`,
    description: `Submitted by ${p.teacher.name} for ${p.plannedDate}`,
    priority: isOnOrBefore(p.plannedDate, today) ? "high" : "normal",
    createdAt: p.createdAt, dueAt: p.plannedDate,
    href: `/teacher/lesson-plans?open=${p.id}`, actionLabel: "Review",
    status: p.status,
  }));
}

async function leaveActions(scope: OrgScope): Promise<ActionItemDto[]> {
  if (!(await isBroadLeaveManager(scope))) return [];
  const data = await listLeaveRequests(scope, { status: "pending" });
  const today = todayIso();
  const soon = new Date();
  soon.setDate(soon.getDate() + 2);
  const soonIso = soon.toISOString().slice(0, 10);
  return data.map((l) => ({
    id: `LEAVE_REQUEST:${l.id}:APPROVE`,
    sourceType: "LeaveRequest", sourceId: l.id,
    category: "leave", title: `Leave request — ${l.staffName}`,
    description: `${l.leaveTypeName}, ${l.startDate}${l.startDate !== l.endDate ? ` to ${l.endDate}` : ""}`,
    priority: isOnOrBefore(l.startDate, today) ? "high" : isOnOrBefore(l.startDate, soonIso) ? "normal" : "low",
    createdAt: l.requestedAt, dueAt: l.startDate,
    href: "/attendance/leave", actionLabel: "Review",
    status: l.status,
  }));
}

async function marksActions(scope: OrgScope): Promise<ActionItemDto[]> {
  const [broadManager, staff, summary] = await Promise.all([isBroadMarksManager(scope), getCurrentStaffProfile(scope), listMarksSummary(scope)]);
  const today = todayIso();

  if (broadManager) {
    return summary
      .filter((m) => m.sheetStatus === "submitted")
      .map((m) => ({
        id: `EXAM_MARK_SHEET:${m.entryId}:VERIFY`,
        sourceType: "ExamMarkSheet", sourceId: m.entryId,
        category: "marks", title: `Verify marks — ${m.examName}: ${m.subject.name}`,
        description: `${m.section.className}-${m.section.name} · ${m.enteredCount}/${m.totalStudents} entered`,
        priority: isOnOrBefore(m.examDate, today) ? "high" : "normal",
        createdAt: `${m.examDate}T00:00:00.000Z`, dueAt: m.examDate,
        href: "/marks/verification", actionLabel: "Verify",
        status: m.sheetStatus,
      }));
  }

  if (!staff?.isTeaching) return [];
  const assignments = await prisma.teachingAssignment.findMany({ where: { staffId: staff.id, schoolId: scope.schoolId }, select: { sectionId: true, subjectId: true } });
  const owned = new Set(assignments.map((a) => `${a.sectionId}::${a.subjectId}`));
  return summary
    .filter((m) => owned.has(`${m.section.id}::${m.subject.id}`) && m.sheetStatus === "draft")
    .map((m) => ({
      id: `EXAM_MARK_SHEET:${m.entryId}:ENTER`,
      sourceType: "ExamMarkSheet", sourceId: m.entryId,
      category: "marks", title: `Enter marks — ${m.examName}: ${m.subject.name}`,
      description: `${m.section.className}-${m.section.name} · ${m.enteredCount}/${m.totalStudents} entered`,
      priority: isOnOrBefore(m.examDate, today) ? "high" : "normal",
      createdAt: `${m.examDate}T00:00:00.000Z`, dueAt: m.examDate,
      href: "/marks/entry", actionLabel: "Enter",
      status: m.sheetStatus,
    }));
}

async function feesActions(scope: OrgScope): Promise<ActionItemDto[]> {
  if (!(await isBroadFeeManager(scope))) return [];
  const report = await getFeeReconciliationReport(scope);
  const items: ActionItemDto[] = [];
  const total = report.unreconciled + report.mismatch;
  if (total > 0) {
    items.push({
      id: `FEE_RECONCILIATION:${scope.schoolId}:RECONCILE`,
      sourceType: "FeePayment", sourceId: scope.schoolId,
      category: "fees",
      title: `${total} fee payment${total === 1 ? "" : "s"} need${total === 1 ? "s" : ""} reconciliation`,
      description: report.mismatch > 0 ? `${report.mismatch} mismatched, ${report.unreconciled} unreconciled` : `${report.unreconciled} unreconciled`,
      priority: report.mismatch > 0 ? "high" : "normal",
      createdAt: new Date().toISOString(), dueAt: null,
      href: "/fees/reconciliation", actionLabel: "Reconcile",
      status: "unreconciled",
    });
  }
  return items;
}

async function payrollActions(scope: OrgScope): Promise<ActionItemDto[]> {
  if (!(await isBroadPayrollManager(scope))) return [];
  const [calculated, finalized] = await Promise.all([listPayrollRuns(scope, { status: "calculated" }), listPayrollRuns(scope, { status: "finalized" })]);
  const items: ActionItemDto[] = [
    ...calculated.map((r) => ({
      id: `PAYROLL_RUN:${r.id}:FINALIZE`,
      sourceType: "PayrollRun", sourceId: r.id,
      category: "payroll" as const, title: `Finalize payroll — ${r.period}`,
      description: `${r.staffCount} staff, net ${r.totalNet}`,
      priority: "normal" as const, createdAt: r.calculatedAt ?? new Date().toISOString(), dueAt: null,
      href: "/payroll/run", actionLabel: "Finalize",
      status: r.status,
    })),
    ...finalized.map((r) => ({
      id: `PAYROLL_RUN:${r.id}:PAY`,
      sourceType: "PayrollRun", sourceId: r.id,
      category: "payroll" as const, title: `Record payment — ${r.period}`,
      description: `${r.staffCount} staff, net ${r.totalNet}`,
      priority: "normal" as const, createdAt: r.finalizedAt ?? new Date().toISOString(), dueAt: null,
      href: "/payroll/run", actionLabel: "Pay",
      status: r.status,
    })),
  ];
  return items;
}

async function visitorActions(scope: OrgScope): Promise<ActionItemDto[]> {
  if (!(await isBroadVisitorManager(scope))) return [];
  const [expected, checkedIn] = await Promise.all([
    listVisits(scope, { status: "expected" }),
    listVisits(scope, { status: "checked_in" }),
  ]);
  const items: ActionItemDto[] = [
    ...expected.data.map((v) => ({
      id: `VISITOR_VISIT:${v.id}:CHECK_IN`,
      sourceType: "VisitorVisit", sourceId: v.id,
      category: "visitor" as const, title: `Expected visitor — ${v.visitorName}`,
      description: `${v.purpose}${v.hostName ? ` · Host: ${v.hostName}` : ""}`,
      priority: "normal" as const, createdAt: v.expectedAt ?? new Date().toISOString(), dueAt: v.expectedAt,
      href: "/front-desk/visitors", actionLabel: "Check in",
      status: v.status,
    })),
    ...checkedIn.data.map((v) => ({
      id: `VISITOR_VISIT:${v.id}:CHECK_OUT`,
      sourceType: "VisitorVisit", sourceId: v.id,
      category: "visitor" as const, title: `Checked-in visitor — ${v.visitorName}`,
      description: `${v.purpose}${v.hostName ? ` · Host: ${v.hostName}` : ""}`,
      // No real checkout-SLA/timeout policy exists — never fabricate urgency from elapsed time.
      priority: "normal" as const, createdAt: v.checkedInAt ?? new Date().toISOString(), dueAt: null,
      href: "/front-desk/visitors", actionLabel: "Check out",
      status: v.status,
    })),
  ];
  return items;
}

async function communicationActions(scope: OrgScope, perms: ActionInboxPermFlags): Promise<ActionItemDto[]> {
  if (!perms.communication) return [];
  const count = await getUnreadCount(scope);
  if (count === 0) return [];
  return [{
    id: `COMMUNICATION:${scope.actor.id}:READ`,
    sourceType: "Conversation", sourceId: scope.actor.id,
    category: "communication", title: `${count} unread conversation${count === 1 ? "" : "s"}`,
    description: "Messages waiting for a reply",
    priority: "normal", createdAt: new Date().toISOString(), dueAt: null,
    href: "/teacher/messages", actionLabel: "Open",
    status: "unread",
  }];
}

async function libraryActions(scope: OrgScope): Promise<ActionItemDto[]> {
  if (!(await isBroadLibraryManager(scope))) return [];
  const issued = await listLoans(scope, { status: "issued" });
  return issued
    .filter((l) => l.isOverdue)
    .map((l) => ({
      id: `LIBRARY_LOAN:${l.id}:FOLLOW_UP`,
      sourceType: "LibraryLoan", sourceId: l.id,
      category: "library" as const, title: `Overdue — ${l.bookTitle}`,
      description: `${l.borrowerName} · ${l.daysOverdue}d overdue`,
      priority: l.daysOverdue > 7 ? "high" : "normal",
      createdAt: l.issuedAt, dueAt: l.dueAt,
      href: "/library/loans", actionLabel: "Follow up",
      status: l.status,
    }));
}

async function inventoryActions(scope: OrgScope): Promise<ActionItemDto[]> {
  if (!(await isBroadInventoryManager(scope))) return [];
  const dashboard = await getInventoryDashboard(scope);
  return dashboard.lowStockItems.map((i) => ({
    id: `INVENTORY_ITEM:${i.id}:REORDER`,
    sourceType: "InventoryItem", sourceId: i.id,
    category: "inventory" as const, title: `Low stock — ${i.name}`,
    description: `${i.quantity} on hand · reorder at ${i.reorderLevel}`,
    priority: i.quantity <= 0 ? "high" : "normal",
    createdAt: new Date().toISOString(), dueAt: null,
    href: "/inventory/low-stock", actionLabel: "Review",
    status: i.quantity <= 0 ? "out-of-stock" : "low-stock",
  }));
}

function priorityRank(p: ActionPriorityDto): number {
  return { urgent: 0, high: 1, normal: 2, low: 3 }[p];
}

export type ActionInboxFilters = { category?: ActionCategoryDto; priority?: ActionPriorityDto };

export async function getActionInbox(scope: OrgScope, perms: ActionInboxPermFlags, filters: ActionInboxFilters = {}): Promise<ActionItemDto[]> {
  const groups = await Promise.all([
    lessonPlanActions(scope),
    leaveActions(scope),
    marksActions(scope),
    feesActions(scope),
    payrollActions(scope),
    visitorActions(scope),
    communicationActions(scope, perms),
    libraryActions(scope),
    inventoryActions(scope),
  ]);
  let items = groups.flat();
  if (filters.category) items = items.filter((i) => i.category === filters.category);
  if (filters.priority) items = items.filter((i) => i.priority === filters.priority);
  return items.sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || b.createdAt.localeCompare(a.createdAt));
}

export async function getActionInboxSummary(scope: OrgScope, perms: ActionInboxPermFlags): Promise<ActionInboxSummaryDto> {
  const items = await getActionInbox(scope, perms);
  const byPriority = Object.fromEntries(PRIORITIES.map((p) => [p, 0])) as Record<ActionPriorityDto, number>;
  const byCategory = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<ActionCategoryDto, number>;
  for (const item of items) {
    byPriority[item.priority] += 1;
    byCategory[item.category] += 1;
  }
  return { total: items.length, byPriority, byCategory };
}
