import { getSnapshot, setState, type Db } from "@/lib/data/store";
import type { FeeComponent, FeeInstallment, FeeStructure } from "@/lib/types/fees";
import { compareMoney, isNegative, sumMoney, type Money } from "@/lib/finance/money";
import { generateId } from "@/lib/utils";
import { logFinancialAudit } from "./finance-audit-service";

export type FeeStructureDraft = Omit<FeeStructure, "id" | "version" | "previousVersionId" | "createdAt" | "updatedAt" | "status"> & { status?: FeeStructure["status"] };

export function structureTotal(structure: Pick<FeeStructure, "components" | "currency">): Money {
  return sumMoney(
    structure.components.filter((c) => !c.optional).map((c) => c.amount),
    structure.currency,
  );
}

export function installmentTotal(structure: Pick<FeeStructure, "installments" | "currency">): Money {
  return sumMoney(
    structure.installments.map((i) => i.amount),
    structure.currency,
  );
}

export type FeeStructureValidation = { valid: boolean; errors: string[] };

/** Runs every structural-integrity rule from the fee-structure spec against
 * a candidate structure before it can be saved as active — mirrors the
 * grading scheme's validateSchemeRanges() in intent: catch nonsense at save
 * time rather than let it reach a student's bill. */
export function validateFeeStructure(candidate: FeeStructureDraft, db: Db, excludeId?: string): FeeStructureValidation {
  const errors: string[] = [];

  if (candidate.components.length === 0) {
    errors.push("Add at least one fee component.");
  }

  for (const component of candidate.components) {
    if (isNegative(component.amount)) {
      errors.push(`"${component.label}" has a negative amount.`);
    }
    if (component.taxPercent !== undefined) {
      if (!component.taxable) errors.push(`"${component.label}" has a tax percent set but is not marked taxable.`);
      if (component.taxPercent < 0 || component.taxPercent > 100) errors.push(`"${component.label}" has an invalid tax percent (${component.taxPercent}%).`);
    }
  }

  const nonCustomTypes = candidate.components.filter((c) => c.type !== "custom").map((c) => c.type);
  const duplicateTypes = [...new Set(nonCustomTypes.filter((t, i) => nonCustomTypes.indexOf(t) !== i))];
  for (const type of duplicateTypes) {
    errors.push(`This structure has more than one "${type}" component — merge them or mark one as custom.`);
  }

  if (candidate.gracePeriodDays < 0) errors.push("Grace period cannot be negative.");

  const dueDates = candidate.installments.map((i) => i.dueDate);
  const duplicateDueDates = [...new Set(dueDates.filter((d, i) => dueDates.indexOf(d) !== i))];
  for (const date of duplicateDueDates) {
    errors.push(`Two installments share the same due date (${date}).`);
  }

  if (candidate.installments.length === 0) {
    errors.push("Add at least one installment.");
  } else {
    const expected = structureTotal(candidate);
    const actual = installmentTotal(candidate);
    if (compareMoney(expected, actual) !== 0) {
      errors.push(`Installment total does not match the structure total (expected ${expected.minorUnits / 100}, got ${actual.minorUnits / 100}).`);
    }
  }

  const overlapsExisting = db.feeStructures.some((s) => {
    if (s.id === excludeId) return false;
    if (s.status !== "active" || s.session !== candidate.session) return false;
    const candidateAll = candidate.applicableClassIds.length === 0;
    const existingAll = s.applicableClassIds.length === 0;
    if (candidateAll || existingAll) return true;
    return candidate.applicableClassIds.some((id) => s.applicableClassIds.includes(id));
  });
  if (overlapsExisting && (candidate.status ?? "active") === "active") {
    errors.push("Another active structure already covers one or more of these classes for this session.");
  }

  return { valid: errors.length === 0, errors };
}

export function createFeeStructure(draft: FeeStructureDraft, actor: { name: string; role: string }): { structure: FeeStructure } | { errors: string[] } {
  const db = getSnapshot();
  const validation = validateFeeStructure(draft, db);
  if (!validation.valid) return { errors: validation.errors };

  const now = new Date().toISOString();
  const structure: FeeStructure = { ...draft, id: generateId("fs"), status: draft.status ?? "draft", version: 1, createdAt: now, updatedAt: now };
  setState((current) => ({ ...current, feeStructures: [...current.feeStructures, structure] }));
  logFinancialAudit({ subjectId: structure.id, action: "fee-structure-created", actorName: actor.name, actorRole: actor.role, summary: `Fee structure "${structure.name}" created for ${structure.session}.`, session: structure.session });
  return { structure };
}

export function updateFeeStructure(structureId: string, patch: Partial<FeeStructureDraft>, actor: { name: string; role: string }): { structure: FeeStructure } | { errors: string[] } {
  const db = getSnapshot();
  const existing = db.feeStructures.find((s) => s.id === structureId);
  if (!existing) return { errors: ["Fee structure not found."] };

  const candidate: FeeStructureDraft = { ...existing, ...patch };
  const validation = validateFeeStructure(candidate, db, structureId);
  if (!validation.valid) return { errors: validation.errors };

  const updated: FeeStructure = { ...existing, ...patch, updatedAt: new Date().toISOString() };
  setState((current) => ({ ...current, feeStructures: current.feeStructures.map((s) => (s.id === structureId ? updated : s)) }));
  logFinancialAudit({ subjectId: structureId, action: "fee-structure-updated", actorName: actor.name, actorRole: actor.role, summary: `Fee structure "${updated.name}" updated.`, session: updated.session });
  return { structure: updated };
}

export function archiveFeeStructure(structureId: string, actor: { name: string; role: string }) {
  setState((db) => ({ ...db, feeStructures: db.feeStructures.map((s) => (s.id === structureId ? { ...s, status: "archived", updatedAt: new Date().toISOString() } : s)) }));
  const structure = getSnapshot().feeStructures.find((s) => s.id === structureId);
  logFinancialAudit({ subjectId: structureId, action: "fee-structure-archived", actorName: actor.name, actorRole: actor.role, summary: `Fee structure "${structure?.name ?? structureId}" archived.` });
}

export function unarchiveFeeStructure(structureId: string, actor: { name: string; role: string }) {
  setState((db) => ({ ...db, feeStructures: db.feeStructures.map((s) => (s.id === structureId ? { ...s, status: "draft", updatedAt: new Date().toISOString() } : s)) }));
  const structure = getSnapshot().feeStructures.find((s) => s.id === structureId);
  logFinancialAudit({ subjectId: structureId, action: "fee-structure-updated", actorName: actor.name, actorRole: actor.role, summary: `Fee structure "${structure?.name ?? structureId}" restored to draft.` });
}

export function duplicateFeeStructure(structureId: string, actor: { name: string; role: string }): FeeStructure | undefined {
  const db = getSnapshot();
  const source = db.feeStructures.find((s) => s.id === structureId);
  if (!source) return undefined;
  const now = new Date().toISOString();
  const copy: FeeStructure = {
    ...source,
    id: generateId("fs"),
    name: `Copy of ${source.name}`,
    status: "draft",
    version: 1,
    previousVersionId: undefined,
    components: source.components.map((c) => ({ ...c, id: generateId("fc") })),
    installments: source.installments.map((i) => ({ ...i, id: generateId("fi") })),
    createdAt: now,
    updatedAt: now,
  };
  setState((current) => ({ ...current, feeStructures: [...current.feeStructures, copy] }));
  logFinancialAudit({ subjectId: copy.id, action: "fee-structure-created", actorName: actor.name, actorRole: actor.role, summary: `Fee structure "${copy.name}" created by duplicating "${source.name}".` });
  return copy;
}

/** Clones a structure into a new session, shifting installment due dates by
 * the same number of days the session boundary itself shifts — a rough but
 * useful starting point the admin edits, not a guarantee of exact re-alignment. */
export function copyFromPreviousSession(structureId: string, newSession: string, actor: { name: string; role: string }): FeeStructure | undefined {
  const db = getSnapshot();
  const source = db.feeStructures.find((s) => s.id === structureId);
  if (!source) return undefined;
  const now = new Date().toISOString();
  const copy: FeeStructure = {
    ...source,
    id: generateId("fs"),
    name: source.name.replace(source.session, newSession),
    session: newSession,
    status: "draft",
    version: 1,
    previousVersionId: source.id,
    components: source.components.map((c) => ({ ...c, id: generateId("fc") })),
    installments: source.installments.map((i) => ({ ...i, id: generateId("fi") })),
    createdAt: now,
    updatedAt: now,
  };
  setState((current) => ({ ...current, feeStructures: [...current.feeStructures, copy] }));
  logFinancialAudit({ subjectId: copy.id, action: "fee-structure-created", actorName: actor.name, actorRole: actor.role, summary: `Fee structure "${copy.name}" copied from ${source.session} into ${newSession}.`, session: newSession });
  return copy;
}

/** Pure preview of what a student would be billed under this structure,
 * given which optional components they opt into — used by both the
 * structure workspace's "preview student bill" and the assignment workflow. */
export function previewStudentBill(structure: FeeStructure, optionalComponentIds: string[]): { components: FeeComponent[]; installments: FeeInstallment[]; total: Money } {
  const optedIn = new Set(optionalComponentIds);
  const components = structure.components.filter((c) => !c.optional || optedIn.has(c.id));
  const total = sumMoney(components.map((c) => c.amount), structure.currency);
  return { components, installments: structure.installments, total };
}

