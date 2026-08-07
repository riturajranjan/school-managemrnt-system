import { getSnapshot, setState, type Db } from "@/lib/data/store";
import { addMoney, moneyFromMajor } from "@/lib/finance/money";
import type { TransportFeeCharge, TransportFeeChargeStatus, TransportFeeRule } from "@/lib/types/transport";
import { generateId } from "@/lib/utils";
import { logTransportAudit } from "./transport-audit-service";

type Actor = { name: string; role: string };
type Result = { ok: true } | { ok: false; error: string };

export type TransportFeeRuleDraft = Omit<TransportFeeRule, "id" | "createdAt" | "status">;

export function createTransportFeeRule(draft: TransportFeeRuleDraft, actor: Actor): TransportFeeRule {
  const rule: TransportFeeRule = { ...draft, id: generateId("tfr"), status: "active", createdAt: new Date().toISOString() };
  setState((db) => ({ ...db, transportFeeRules: [...db.transportFeeRules, rule] }));
  logTransportAudit({ action: "document-updated", actorName: actor.name, actorRole: actor.role, summary: `Transport fee rule "${rule.name}" created.` });
  return rule;
}

export function setTransportFeeRuleStatus(ruleId: string, status: TransportFeeRule["status"], actor: Actor): Result {
  const db = getSnapshot();
  const rule = db.transportFeeRules.find((r) => r.id === ruleId);
  if (!rule) return { ok: false, error: "Fee rule not found." };
  setState((current) => ({ ...current, transportFeeRules: current.transportFeeRules.map((r) => (r.id === ruleId ? { ...r, status } : r)) }));
  logTransportAudit({ action: "document-updated", actorName: actor.name, actorRole: actor.role, summary: `Transport fee rule "${rule.name}" marked ${status}.` });
  return { ok: true };
}

/** Route match wins over vehicle-type over a flat fallback — the same
 * specificity-first resolution order the basis field implies. */
export function resolveFeeRuleForRoute(db: Db, routeId: string, session: string): TransportFeeRule | undefined {
  const route = db.transportRoutes.find((r) => r.id === routeId);
  const activeRules = db.transportFeeRules.filter((r) => r.status === "active" && r.session === session);
  return (
    activeRules.find((r) => r.basis === "route" && r.routeId === routeId) ??
    (route ? activeRules.find((r) => r.basis === "vehicle-type" && r.vehicleType === route.vehicleType) : undefined) ??
    activeRules.find((r) => r.basis === "flat")
  );
}

function computeBilledAmount(rule: TransportFeeRule, discountPercent: number | undefined): TransportFeeCharge["billedAmount"] {
  if (!discountPercent) return rule.amount;
  return moneyFromMajor(Math.round((rule.amount.minorUnits / 100) * (1 - discountPercent / 100)), rule.amount.currency);
}

function periodDueDate(period: string): string {
  return `${period}-10`;
}

export type GenerateChargesResult = { created: number; skippedExisting: number; skippedNoRule: number };

/** Idempotent — running it twice for the same period never double-bills a
 * student, mirroring the once-per-period guarantee Phase 5's late-fee/reminder
 * generators use. */
export function generateChargesForPeriod(session: string, period: string, actor: Actor): GenerateChargesResult {
  const db = getSnapshot();
  const result: GenerateChargesResult = { created: 0, skippedExisting: 0, skippedNoRule: 0 };
  const newCharges: TransportFeeCharge[] = [];

  const activeStudentAssignments = db.studentTransportAssignments.filter((a) => a.status === "active" && a.session === session);
  for (const assignment of activeStudentAssignments) {
    const alreadyBilled = db.transportFeeCharges.some((c) => c.assignmentId === assignment.id && c.period === period);
    if (alreadyBilled) {
      result.skippedExisting += 1;
      continue;
    }
    const rule = resolveFeeRuleForRoute(db, assignment.routeId, session);
    if (!rule) {
      result.skippedNoRule += 1;
      continue;
    }
    const student = db.students.find((s) => s.id === assignment.studentId);
    const discountPercent = student?.admissionType === "sibling" ? rule.siblingDiscountPercent : undefined;
    newCharges.push({
      id: generateId("tfc"),
      feeRuleId: rule.id,
      subjectType: "student",
      studentId: assignment.studentId,
      assignmentId: assignment.id,
      session,
      period,
      billedAmount: computeBilledAmount(rule, discountPercent),
      discountPercent,
      paidAmount: moneyFromMajor(0, rule.amount.currency),
      dueDate: periodDueDate(period),
      status: "pending",
      createdAt: new Date().toISOString(),
    });
    result.created += 1;
  }

  const activeStaffAssignments = db.staffTransportAssignments.filter((a) => a.status === "active");
  for (const assignment of activeStaffAssignments) {
    const alreadyBilled = db.transportFeeCharges.some((c) => c.assignmentId === assignment.id && c.period === period);
    if (alreadyBilled) {
      result.skippedExisting += 1;
      continue;
    }
    const rule = resolveFeeRuleForRoute(db, assignment.routeId, session);
    if (!rule) {
      result.skippedNoRule += 1;
      continue;
    }
    newCharges.push({
      id: generateId("tfc"),
      feeRuleId: rule.id,
      subjectType: "staff",
      staffId: assignment.staffId,
      assignmentId: assignment.id,
      session,
      period,
      billedAmount: computeBilledAmount(rule, rule.staffDiscountPercent),
      discountPercent: rule.staffDiscountPercent,
      paidAmount: moneyFromMajor(0, rule.amount.currency),
      dueDate: periodDueDate(period),
      status: "pending",
      createdAt: new Date().toISOString(),
    });
    result.created += 1;
  }

  if (newCharges.length > 0) {
    setState((current) => ({ ...current, transportFeeCharges: [...current.transportFeeCharges, ...newCharges] }));
    logTransportAudit({ action: "document-updated", actorName: actor.name, actorRole: actor.role, summary: `${newCharges.length} transport fee charge(s) generated for ${period}.` });
  }
  return result;
}

function nextChargeStatus(charge: TransportFeeCharge, paidAmount: TransportFeeCharge["paidAmount"]): TransportFeeChargeStatus {
  if (paidAmount.minorUnits <= 0) return "pending";
  if (paidAmount.minorUnits < charge.billedAmount.minorUnits) return "partial";
  return "paid";
}

export function recordChargePayment(chargeId: string, amount: TransportFeeCharge["paidAmount"], actor: Actor): Result {
  const db = getSnapshot();
  const charge = db.transportFeeCharges.find((c) => c.id === chargeId);
  if (!charge) return { ok: false, error: "Fee charge not found." };
  if (charge.status === "waived" || charge.status === "cancelled") return { ok: false, error: `Charge is ${charge.status} and cannot accept payment.` };

  const paidAmount = addMoney(charge.paidAmount, amount);
  const status = nextChargeStatus(charge, paidAmount);

  setState((current) => ({ ...current, transportFeeCharges: current.transportFeeCharges.map((c) => (c.id === chargeId ? { ...c, paidAmount, status } : c)) }));
  logTransportAudit({ subjectId: charge.studentId ?? charge.staffId, action: "document-updated", actorName: actor.name, actorRole: actor.role, summary: `Payment recorded against transport fee charge for ${charge.period}.` });
  return { ok: true };
}

export function waiveCharge(chargeId: string, reason: string, actor: Actor): Result {
  const db = getSnapshot();
  const charge = db.transportFeeCharges.find((c) => c.id === chargeId);
  if (!charge) return { ok: false, error: "Fee charge not found." };

  setState((current) => ({ ...current, transportFeeCharges: current.transportFeeCharges.map((c) => (c.id === chargeId ? { ...c, status: "waived" } : c)) }));
  logTransportAudit({ subjectId: charge.studentId ?? charge.staffId, action: "document-updated", actorName: actor.name, actorRole: actor.role, summary: `Transport fee charge for ${charge.period} waived.`, reason });
  return { ok: true };
}
