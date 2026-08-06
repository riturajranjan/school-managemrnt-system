import { getSnapshot, setState } from "@/lib/data/store";
import type { SalaryComponent, SalaryStructure } from "@/lib/types/payroll";
import { generateId } from "@/lib/utils";
import { logFinancialAudit } from "./finance-audit-service";

type Actor = { name: string; role: string };

/** Components carry a client-generated id so `percentOfComponentId` cross-
 * references (e.g. HRA = 40% of Basic) resolve correctly — the service does
 * not regenerate ids, since doing so would silently break those links. */
export type SalaryComponentDraft = SalaryComponent;
export type SalaryStructureDraft = { name: string; employeeId: string; session: string; currency: SalaryStructure["currency"]; effectiveFrom: string; components: SalaryComponentDraft[] };

export function createSalaryStructure(draft: SalaryStructureDraft, actor: Actor): SalaryStructure {
  const now = new Date().toISOString();
  const db = getSnapshot();
  const structure: SalaryStructure = {
    id: generateId("sal"),
    name: draft.name,
    employeeId: draft.employeeId,
    session: draft.session,
    components: draft.components,
    currency: draft.currency,
    effectiveFrom: draft.effectiveFrom,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
  // An employee has at most one active structure at a time — activating a
  // new one supersedes the old rather than running two in parallel.
  setState((current) => ({
    ...current,
    salaryStructures: [...current.salaryStructures.map((s) => (s.employeeId === draft.employeeId && s.status === "active" ? { ...s, status: "inactive" as const, updatedAt: now } : s)), structure],
  }));
  const supersededCount = db.salaryStructures.filter((s) => s.employeeId === draft.employeeId && s.status === "active").length;
  logFinancialAudit({ action: "journal-posted", actorName: actor.name, actorRole: actor.role, summary: `Salary structure "${structure.name}" created${supersededCount > 0 ? " (supersedes previous active structure)" : ""}.` });
  return structure;
}

export function updateSalaryStructure(structureId: string, patch: Partial<Omit<SalaryStructureDraft, "employeeId">>, actor: Actor): { ok: true } | { ok: false; error: string } {
  const db = getSnapshot();
  const structure = db.salaryStructures.find((s) => s.id === structureId);
  if (!structure) return { ok: false, error: "Salary structure not found." };

  const now = new Date().toISOString();
  setState((current) => ({
    ...current,
    salaryStructures: current.salaryStructures.map((s) =>
      s.id === structureId ? { ...s, name: patch.name ?? s.name, session: patch.session ?? s.session, currency: patch.currency ?? s.currency, effectiveFrom: patch.effectiveFrom ?? s.effectiveFrom, components: patch.components ?? s.components, updatedAt: now } : s,
    ),
  }));
  logFinancialAudit({ action: "journal-posted", actorName: actor.name, actorRole: actor.role, summary: `Salary structure "${structure.name}" updated.` });
  return { ok: true };
}

export function deactivateSalaryStructure(structureId: string, actor: Actor): { ok: true } | { ok: false; error: string } {
  const db = getSnapshot();
  const structure = db.salaryStructures.find((s) => s.id === structureId);
  if (!structure) return { ok: false, error: "Salary structure not found." };
  setState((current) => ({ ...current, salaryStructures: current.salaryStructures.map((s) => (s.id === structureId ? { ...s, status: "inactive", updatedAt: new Date().toISOString() } : s)) }));
  logFinancialAudit({ action: "journal-posted", actorName: actor.name, actorRole: actor.role, summary: `Salary structure "${structure.name}" deactivated.` });
  return { ok: true };
}
