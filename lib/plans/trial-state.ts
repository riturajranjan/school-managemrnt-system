// Client-side labels + tones for derived trial states (Super Admin SA-4C).
// States are computed server-side from the trial's persisted dates.
import type { StatusTone } from "@/lib/types/common";

const LABELS: Record<string, string> = {
  active: "Active",
  expiring: "Expiring soon",
  expired: "Expired",
  converted: "Converted",
  ended: "Ended",
};

const TONES: Record<string, StatusTone> = {
  active: "info",
  expiring: "warning",
  expired: "error",
  converted: "success",
  ended: "neutral",
};

/** A trial state that still represents a live TRIALING subscription (actionable). */
export const LIVE_TRIAL_STATES = new Set(["active", "expiring", "expired"]);

export function trialStateLabel(state: string): string {
  return LABELS[state] ?? state;
}
export function trialStateTone(state: string): StatusTone {
  return TONES[state] ?? "neutral";
}
