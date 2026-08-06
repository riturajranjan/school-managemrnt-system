import { getSnapshot, setState } from "@/lib/data/store";
import type { Concession, ConcessionReason, Discount, DiscountType, Scholarship, ScholarshipType } from "@/lib/types/fees";
import { sumMoney, zeroMoney, type Money } from "@/lib/finance/money";
import { generateId } from "@/lib/utils";
import { logFinancialAudit } from "./finance-audit-service";
import { applyWaiverToItems, reverseWaiverOnUnpaidItems } from "./fee-waiver-utils";

type Actor = { name: string; role: string };
type WaiverKind = "discount" | "scholarship" | "concession";

function waiverAmount(record: { percent?: number; amount?: Money }, studentId: string, applicableComponentIds: string[]): Money {
  const db = getSnapshot();
  const items = db.studentFeeItems.filter((i) => i.studentId === studentId && applicableComponentIds.includes(i.componentId) && i.status !== "cancelled" && i.status !== "paid");
  const billedTotal = sumMoney(items.map((i) => i.billedAmount), items[0]?.billedAmount.currency ?? "INR");
  if (record.percent !== undefined) return { minorUnits: Math.round((billedTotal.minorUnits * record.percent) / 100), currency: billedTotal.currency };
  return record.amount ?? zeroMoney(billedTotal.currency);
}

export type RequestDiscountInput = { studentId: string; name: string; type: DiscountType; percent?: number; amount?: Money; applicableComponentIds: string[]; session: string; effectiveFrom: string; effectiveTo?: string; maxAmount?: Money };
export type RequestScholarshipInput = { studentId: string; name: string; type: ScholarshipType; percent?: number; amount?: Money; applicableComponentIds: string[]; session: string; effectiveFrom: string; effectiveTo?: string; renewable?: boolean; budgetId?: string };
export type RequestConcessionInput = { studentId: string; reason: ConcessionReason; description: string; amount: Money; applicableComponentIds: string[]; effectiveFrom: string; effectiveTo?: string };

export type RequestResult<T> = { ok: true; record: T } | { ok: false; errors: string[] };

function overlaps(aFrom: string, aTo: string | undefined, bFrom: string, bTo: string | undefined): boolean {
  const aEnd = aTo ?? "9999-12-31";
  const bEnd = bTo ?? "9999-12-31";
  return aFrom <= bEnd && bFrom <= aEnd;
}

export function requestDiscount(input: RequestDiscountInput, actor: Actor): RequestResult<Discount> {
  const db = getSnapshot();
  const errors: string[] = [];
  const overlapping = db.discounts.find(
    (d) => d.studentId === input.studentId && d.type === input.type && (d.status === "active" || d.status === "submitted") && overlaps(input.effectiveFrom, input.effectiveTo, d.effectiveFrom, d.effectiveTo),
  );
  if (overlapping) errors.push(`An overlapping "${input.type}" discount is already ${overlapping.status} for this student.`);
  if (input.percent !== undefined && (input.percent < 0 || input.percent > 100)) errors.push("Discount percent must be between 0 and 100.");
  if (errors.length > 0) return { ok: false, errors };

  const now = new Date().toISOString();
  const record: Discount = {
    id: generateId("disc"),
    name: input.name,
    type: input.type,
    studentId: input.studentId,
    percent: input.percent,
    amount: input.amount,
    applicableComponentIds: input.applicableComponentIds,
    session: input.session,
    effectiveFrom: input.effectiveFrom,
    effectiveTo: input.effectiveTo,
    maxAmount: input.maxAmount,
    status: "submitted",
    createdBy: actor.name,
    createdAt: now,
  };
  setState((current) => ({ ...current, discounts: [...current.discounts, record] }));
  logFinancialAudit({ subjectId: input.studentId, action: "discount-applied", actorName: actor.name, actorRole: actor.role, summary: `Discount "${record.name}" requested for approval.`, session: input.session });
  return { ok: true, record };
}

export function requestScholarship(input: RequestScholarshipInput, actor: Actor): RequestResult<Scholarship> {
  const db = getSnapshot();
  const errors: string[] = [];
  const duplicate = db.scholarships.find((s) => s.studentId === input.studentId && s.type === input.type && s.session === input.session && (s.status === "active" || s.status === "submitted"));
  if (duplicate) errors.push(`A "${input.type}" scholarship already exists for this student this session (${duplicate.status}).`);
  if (input.percent !== undefined && (input.percent < 0 || input.percent > 100)) errors.push("Scholarship percent must be between 0 and 100.");
  if (errors.length > 0) return { ok: false, errors };

  const now = new Date().toISOString();
  const record: Scholarship = {
    id: generateId("schol"),
    name: input.name,
    type: input.type,
    studentId: input.studentId,
    session: input.session,
    percent: input.percent,
    amount: input.amount,
    applicableComponentIds: input.applicableComponentIds,
    budgetId: input.budgetId,
    effectiveFrom: input.effectiveFrom,
    effectiveTo: input.effectiveTo,
    renewable: input.renewable ?? false,
    status: "submitted",
    createdBy: actor.name,
    createdAt: now,
  };
  setState((current) => ({ ...current, scholarships: [...current.scholarships, record] }));
  logFinancialAudit({ subjectId: input.studentId, action: "scholarship-applied", actorName: actor.name, actorRole: actor.role, summary: `Scholarship "${record.name}" requested for approval.`, session: input.session });
  return { ok: true, record };
}

export function requestConcession(input: RequestConcessionInput, actor: Actor): RequestResult<Concession> {
  const now = new Date().toISOString();
  const record: Concession = {
    id: generateId("conc"),
    studentId: input.studentId,
    reason: input.reason,
    description: input.description,
    amount: input.amount,
    applicableComponentIds: input.applicableComponentIds,
    effectiveFrom: input.effectiveFrom,
    effectiveTo: input.effectiveTo,
    status: "submitted",
    createdBy: actor.name,
    createdAt: now,
  };
  setState((current) => ({ ...current, concessions: [...current.concessions, record] }));
  logFinancialAudit({ subjectId: input.studentId, action: "concession-applied", actorName: actor.name, actorRole: actor.role, summary: `Concession requested: ${input.description}`, reason: input.reason });
  return { ok: true, record };
}

function fieldForKind(kind: WaiverKind): "discountAmount" | "scholarshipAmount" {
  return kind === "scholarship" ? "scholarshipAmount" : "discountAmount";
}

export function approveWaiver(kind: WaiverKind, id: string, actor: Actor): { ok: true } | { ok: false; error: string } {
  const db = getSnapshot();
  const collection = kind === "discount" ? db.discounts : kind === "scholarship" ? db.scholarships : db.concessions;
  const record = collection.find((r) => r.id === id);
  if (!record) return { ok: false, error: "Record not found." };
  if (record.status !== "submitted" && record.status !== "under-review") return { ok: false, error: `Cannot approve a record in "${record.status}" status.` };

  const now = new Date().toISOString();
  const amount = waiverAmount(record as { percent?: number; amount?: Money }, record.studentId, record.applicableComponentIds);
  applyWaiverToItems(record.studentId, record.applicableComponentIds, amount, fieldForKind(kind));

  setState((current) => {
    if (kind === "discount") return { ...current, discounts: current.discounts.map((d) => (d.id === id ? { ...d, status: "active", approvedBy: actor.name, approvedAt: now } : d)) };
    if (kind === "scholarship") return { ...current, scholarships: current.scholarships.map((s) => (s.id === id ? { ...s, status: "active", approvedBy: actor.name, approvedAt: now } : s)) };
    return { ...current, concessions: current.concessions.map((c) => (c.id === id ? { ...c, status: "active", approvedBy: actor.name, approvedAt: now } : c)) };
  });

  logFinancialAudit({
    subjectId: record.studentId,
    action: kind === "discount" ? "discount-applied" : kind === "scholarship" ? "scholarship-applied" : "concession-applied",
    actorName: actor.name,
    actorRole: actor.role,
    summary: `${kind[0].toUpperCase()}${kind.slice(1)} approved and applied.`,
  });
  return { ok: true };
}

export function rejectWaiver(kind: WaiverKind, id: string, reason: string, actor: Actor) {
  setState((db) => {
    if (kind === "discount") return { ...db, discounts: db.discounts.map((d) => (d.id === id ? { ...d, status: "rejected" } : d)) };
    if (kind === "scholarship") return { ...db, scholarships: db.scholarships.map((s) => (s.id === id ? { ...s, status: "rejected" } : s)) };
    return { ...db, concessions: db.concessions.map((c) => (c.id === id ? { ...c, status: "rejected" } : c)) };
  });
  const record = getSnapshot();
  const subjectId = kind === "discount" ? record.discounts.find((d) => d.id === id)?.studentId : kind === "scholarship" ? record.scholarships.find((s) => s.id === id)?.studentId : record.concessions.find((c) => c.id === id)?.studentId;
  logFinancialAudit({ subjectId, action: kind === "discount" ? "discount-applied" : kind === "scholarship" ? "scholarship-applied" : "concession-applied", actorName: actor.name, actorRole: actor.role, summary: `${kind[0].toUpperCase()}${kind.slice(1)} rejected.`, reason });
}

export function revokeWaiver(kind: WaiverKind, id: string, reason: string, actor: Actor): { ok: true } | { ok: false; error: string } {
  const db = getSnapshot();
  const collection = kind === "discount" ? db.discounts : kind === "scholarship" ? db.scholarships : db.concessions;
  const record = collection.find((r) => r.id === id);
  if (!record) return { ok: false, error: "Record not found." };
  if (record.status !== "active") return { ok: false, error: "Only an active record can be revoked." };

  const amount = waiverAmount(record as { percent?: number; amount?: Money }, record.studentId, record.applicableComponentIds);
  reverseWaiverOnUnpaidItems(record.studentId, record.applicableComponentIds, amount, fieldForKind(kind));

  setState((current) => {
    if (kind === "discount") return { ...current, discounts: current.discounts.map((d) => (d.id === id ? { ...d, status: "revoked" } : d)) };
    if (kind === "scholarship") return { ...current, scholarships: current.scholarships.map((s) => (s.id === id ? { ...s, status: "revoked" } : s)) };
    return { ...current, concessions: current.concessions.map((c) => (c.id === id ? { ...c, status: "revoked" } : c)) };
  });

  logFinancialAudit({ subjectId: record.studentId, action: kind === "discount" ? "discount-applied" : kind === "scholarship" ? "scholarship-applied" : "concession-applied", actorName: actor.name, actorRole: actor.role, summary: `${kind[0].toUpperCase()}${kind.slice(1)} revoked — unpaid balances restored.`, reason });
  return { ok: true };
}
