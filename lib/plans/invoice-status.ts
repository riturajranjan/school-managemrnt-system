// Client-side labels + tones for invoice derived states (Super Admin SA-4D).
// The API returns both `status` (stored: draft/open/paid/void) and `derivedState`
// (adds `overdue`, computed server-side). UI badges use `derivedState`.
import type { StatusTone } from "@/lib/types/common";

const LABELS: Record<string, string> = {
  draft: "Draft",
  open: "Open",
  overdue: "Overdue",
  paid: "Paid",
  void: "Void",
};

const TONES: Record<string, StatusTone> = {
  draft: "neutral",
  open: "info",
  overdue: "error",
  paid: "success",
  void: "neutral",
};

export function invoiceStateLabel(state: string): string {
  return LABELS[state] ?? state;
}
export function invoiceStateTone(state: string): StatusTone {
  return TONES[state] ?? "neutral";
}
