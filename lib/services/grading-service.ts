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

export function unarchiveGradingScheme(schemeId: string) {
  updateGradingScheme(schemeId, { status: "draft" });
}

export function duplicateGradingScheme(schemeId: string): GradingScheme | undefined {
  const db = getSnapshot();
  const source = db.gradingSchemes.find((s) => s.id === schemeId);
  if (!source) return undefined;
  const now = new Date().toISOString();
  const copy: GradingScheme = {
    ...source,
    id: generateId("gs"),
    name: `Copy of ${source.name}`,
    status: "draft",
    isDefault: false,
    ranges: source.ranges.map((r) => ({ ...r, id: generateId("gr") })),
    createdAt: now,
    updatedAt: now,
  };
  setState((current) => ({ ...current, gradingSchemes: [...current.gradingSchemes, copy] }));
  return copy;
}

/** Only one scheme is ever the default — setting one clears the flag on every other. */
export function setDefaultGradingScheme(schemeId: string) {
  setState((db) => ({
    ...db,
    gradingSchemes: db.gradingSchemes.map((s) => ({ ...s, isDefault: s.id === schemeId, updatedAt: s.id === schemeId ? new Date().toISOString() : s.updatedAt })),
  }));
}

export function assignSchemeClasses(schemeId: string, classIds: string[]) {
  updateGradingScheme(schemeId, { applicableClassIds: classIds });
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
