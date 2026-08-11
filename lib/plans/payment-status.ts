// Client-side labels + tones for payment status/method (Super Admin SA-4E).
// The API speaks UI-kebab values (succeeded | reversed; cash | bank-transfer | …).
import type { StatusTone } from "@/lib/types/common";

const STATUS_LABELS: Record<string, string> = { succeeded: "Succeeded", reversed: "Reversed" };
const STATUS_TONES: Record<string, StatusTone> = { succeeded: "success", reversed: "neutral" };

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  "bank-transfer": "Bank transfer",
  upi: "UPI",
  cheque: "Cheque",
  other: "Other",
};

export const PAYMENT_METHODS = ["cash", "bank-transfer", "upi", "cheque", "other"] as const;

export function paymentStatusLabel(s: string): string {
  return STATUS_LABELS[s] ?? s;
}
export function paymentStatusTone(s: string): StatusTone {
  return STATUS_TONES[s] ?? "neutral";
}
export function paymentMethodLabel(m: string): string {
  return METHOD_LABELS[m] ?? m;
}
