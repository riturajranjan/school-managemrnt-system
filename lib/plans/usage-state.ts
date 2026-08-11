// Client-side labels + tones for derived usage states (Super Admin SA-4G).
// States are computed server-side (usage-service).
import type { StatusTone } from "@/lib/types/common";

const LABELS: Record<string, string> = {
  NORMAL: "Normal",
  WARNING: "Near limit",
  LIMIT_REACHED: "Limit reached",
  UNLIMITED: "Unlimited",
  NOT_TRACKED: "Not tracked yet",
  NO_SUBSCRIPTION: "No subscription",
};

const TONES: Record<string, StatusTone> = {
  NORMAL: "success",
  WARNING: "warning",
  LIMIT_REACHED: "error",
  UNLIMITED: "info",
  NOT_TRACKED: "neutral",
  NO_SUBSCRIPTION: "neutral",
};

// States a user can filter the usage list by.
export const USAGE_FILTER_STATES = ["all", "WARNING", "LIMIT_REACHED", "NORMAL", "UNLIMITED", "NOT_TRACKED", "NO_SUBSCRIPTION"] as const;

export function usageStateLabel(s: string): string {
  return LABELS[s] ?? s;
}
export function usageStateTone(s: string): StatusTone {
  return TONES[s] ?? "neutral";
}
