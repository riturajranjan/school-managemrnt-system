// Client-side labels + tones for subscription statuses (Super Admin SA-4B).
// The API speaks UI-kebab statuses (trialing | active | past-due | cancelled | ended).
import type { StatusTone } from "@/lib/types/common";

const LABELS: Record<string, string> = {
  trialing: "Trialing",
  active: "Active",
  "past-due": "Past due",
  cancelled: "Cancelled",
  ended: "Ended",
};

const TONES: Record<string, StatusTone> = {
  trialing: "info",
  active: "success",
  "past-due": "warning",
  cancelled: "neutral",
  ended: "neutral",
};

export function subscriptionStatusLabel(status: string): string {
  return LABELS[status] ?? status;
}

export function subscriptionStatusTone(status: string): StatusTone {
  return TONES[status] ?? "neutral";
}
