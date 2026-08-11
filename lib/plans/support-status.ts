// Client-side labels + tones for support ticket status / priority / category
// (Super Admin SA-4I). The API speaks UI-kebab values.
import type { StatusTone } from "@/lib/types/common";

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  "in-progress": "In progress",
  "waiting-customer": "Waiting on customer",
  resolved: "Resolved",
  closed: "Closed",
};
const STATUS_TONES: Record<string, StatusTone> = {
  open: "info",
  "in-progress": "warning",
  "waiting-customer": "neutral",
  resolved: "success",
  closed: "neutral",
};

const PRIORITY_TONES: Record<string, StatusTone> = { low: "neutral", medium: "info", high: "warning", urgent: "error" };
const CATEGORY_LABELS: Record<string, string> = {
  billing: "Billing",
  account: "Account",
  technical: "Technical",
  onboarding: "Onboarding",
  feature: "Feature",
  other: "Other",
};

export const SUPPORT_STATUSES = ["all", "open", "in-progress", "waiting-customer", "resolved", "closed"] as const;
export const SUPPORT_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export const SUPPORT_CATEGORIES = ["billing", "account", "technical", "onboarding", "feature", "other"] as const;
// Statuses an agent can move a ticket to from the detail view.
export const SUPPORT_STATUS_TRANSITIONS: Record<string, string[]> = {
  open: ["in-progress", "waiting-customer", "resolved", "closed"],
  "in-progress": ["open", "waiting-customer", "resolved", "closed"],
  "waiting-customer": ["open", "in-progress", "resolved", "closed"],
  resolved: ["open", "in-progress", "closed"],
  closed: ["open"],
};

export function supportStatusLabel(s: string): string {
  return STATUS_LABELS[s] ?? s;
}
export function supportStatusTone(s: string): StatusTone {
  return STATUS_TONES[s] ?? "neutral";
}
export function supportPriorityTone(p: string): StatusTone {
  return PRIORITY_TONES[p] ?? "neutral";
}
export function supportCategoryLabel(c: string): string {
  return CATEGORY_LABELS[c] ?? c;
}
