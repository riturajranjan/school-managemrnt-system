// Client-side labels + tones for derived tenant-health states (Super Admin SA-4F).
// States are computed server-side from real signals.
import type { StatusTone } from "@/lib/types/common";

const LABELS: Record<string, string> = { healthy: "Healthy", attention: "Attention", critical: "Critical" };
const TONES: Record<string, StatusTone> = { healthy: "success", attention: "warning", critical: "error" };

export function healthStateLabel(s: string): string {
  return LABELS[s] ?? s;
}
export function healthStateTone(s: string): StatusTone {
  return TONES[s] ?? "neutral";
}
