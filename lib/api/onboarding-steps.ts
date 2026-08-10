// Canonical school-onboarding steps (Super Admin Phase SA-3). Client-safe (no
// server imports) so both the API/service and the wizard UI share ONE source of
// truth. These are legitimate school SETUP steps only — never business modules
// (students/admissions/attendance/fees/etc., which belong to their own phases).
// Progress is always computed from these keys; no percentage is ever stored.

export type OnboardingStep = { key: string; label: string; description: string };

export const ONBOARDING_STEPS: OnboardingStep[] = [
  { key: "profile", label: "School profile", description: "Confirm the school name, type, board and contact details." },
  { key: "branch", label: "Branch configuration", description: "Confirm the primary campus details." },
  { key: "academic-session", label: "Academic session", description: "Confirm the current academic session dates." },
  { key: "preferences", label: "Preferences", description: "Confirm timezone, locale and currency." },
  { key: "admin", label: "Administrator", description: "Confirm the initial school administrator." },
  { key: "review", label: "Review & activate", description: "Review setup and activate the school." },
];

export const REQUIRED_STEP_KEYS: string[] = ONBOARDING_STEPS.map((s) => s.key);

export function isValidStepKey(key: string): boolean {
  return REQUIRED_STEP_KEYS.includes(key);
}

/** completedRequiredSteps / totalRequiredSteps as a 0..100 integer. */
export function onboardingProgressPercent(completedSteps: string[]): number {
  const done = REQUIRED_STEP_KEYS.filter((k) => completedSteps.includes(k)).length;
  return Math.round((done / REQUIRED_STEP_KEYS.length) * 100);
}
