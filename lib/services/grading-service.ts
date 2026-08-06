import { getSnapshot, setState } from "@/lib/data/store";
import type { GradeRange, GradingScheme, ResultRule } from "@/lib/types/grading";
import { generateId } from "@/lib/utils";
import { validateGradeRanges } from "./result-engine";

export type GradingSchemeInput = Omit<GradingScheme, "id" | "ranges" | "createdAt" | "updatedAt">;

export function createGradingScheme(data: GradingSchemeInput): GradingScheme {
  const now = new Date().toISOString();
  const scheme: GradingScheme = { ...data, id: generateId("gs"), ranges: [], createdAt: now, updatedAt: now };
  setState((db) => ({ ...db, gradingSchemes: [...db.gradingSchemes, scheme] }));
  return scheme;
}

export function updateGradingScheme(schemeId: string, patch: Partial<Omit<GradingScheme, "id" | "ranges">>) {
  setState((db) => ({
    ...db,
    gradingSchemes: db.gradingSchemes.map((s) => (s.id === schemeId ? { ...s, ...patch, updatedAt: new Date().toISOString() } : s)),
  }));
}

export function archiveGradingScheme(schemeId: string) {
  updateGradingScheme(schemeId, { status: "archived" });
}

export type GradeRangeValidation = { valid: boolean; errors: string[] };

/** Validates a candidate range set before it's saved — the same non-overlap check the result engine relies on, so a bad scheme can never reach calculation. */
export function validateSchemeRanges(ranges: GradeRange[]): GradeRangeValidation {
  const errors = validateGradeRanges(ranges);
  if (ranges.length === 0) errors.push("Add at least one grade range.");
  return { valid: errors.length === 0, errors };
}

export function saveGradeRanges(schemeId: string, ranges: Omit<GradeRange, "id">[]): GradeRangeValidation {
  const withIds: GradeRange[] = ranges.map((r, index) => ({ ...r, id: generateId("gr"), order: index + 1 }));
  const validation = validateSchemeRanges(withIds);
  if (!validation.valid) return validation;

  setState((db) => ({
    ...db,
    gradingSchemes: db.gradingSchemes.map((s) => (s.id === schemeId ? { ...s, ranges: withIds, updatedAt: new Date().toISOString() } : s)),
  }));
  return validation;
}

export type ResultRuleInput = Omit<ResultRule, "id" | "createdAt" | "updatedAt">;

export function createResultRule(data: ResultRuleInput): ResultRule {
  const now = new Date().toISOString();
  const rule: ResultRule = { ...data, id: generateId("rr"), createdAt: now, updatedAt: now };
  setState((db) => ({ ...db, resultRules: [...db.resultRules, rule] }));
  return rule;
}

export function updateResultRule(ruleId: string, patch: Partial<Omit<ResultRule, "id">>) {
  setState((db) => ({
    ...db,
    resultRules: db.resultRules.map((r) => (r.id === ruleId ? { ...r, ...patch, updatedAt: new Date().toISOString() } : r)),
  }));
}

export function deleteResultRule(ruleId: string): { ok: true } | { ok: false; error: string } {
  const db = getSnapshot();
  const inUse = db.exams.some((e) => e.resultRuleId === ruleId);
  if (inUse) return { ok: false, error: "This rule is used by at least one exam and can't be deleted." };
  setState((current) => ({ ...current, resultRules: current.resultRules.filter((r) => r.id !== ruleId) }));
  return { ok: true };
}
