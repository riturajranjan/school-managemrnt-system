import { AlertTriangle, BadgeCheck, Ban, Clock, HelpCircle, RefreshCw } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { documentTypeLabels, verificationStateLabels, type DocumentType, type VerificationState } from "@/lib/types/documents";
import { formatDate } from "@/lib/utils";

const STATE_META: Record<VerificationState, { icon: LucideIcon; ring: string; text: string; bg: string }> = {
  valid: { icon: BadgeCheck, ring: "border-success/40", text: "text-success", bg: "bg-success/8" },
  revoked: { icon: Ban, ring: "border-error/40", text: "text-error", bg: "bg-error/8" },
  expired: { icon: Clock, ring: "border-warning/40", text: "text-warning", bg: "bg-warning/8" },
  replaced: { icon: RefreshCw, ring: "border-border", text: "text-muted-foreground", bg: "bg-surface-secondary/40" },
  "invalid-token": { icon: AlertTriangle, ring: "border-error/40", text: "text-error", bg: "bg-error/8" },
  "not-found": { icon: HelpCircle, ring: "border-error/40", text: "text-error", bg: "bg-error/8" },
};

/** Verification outcome card. Shows ONLY permitted fields (type, number, name,
 * issued date, status) — never medical info, addresses or phone numbers. */
export function VerifyResult({ state, record }: { state: VerificationState; record?: { documentNumber: string; type: DocumentType; recipientName: string; issuedDate: string } }) {
  const meta = STATE_META[state];
  const Icon = meta.icon;
  return (
    <div className={`flex flex-col gap-md rounded-xl border p-md ${meta.ring} ${meta.bg}`} role="status">
      <div className="flex items-center gap-sm">
        <span className={`flex size-11 items-center justify-center rounded-full border-2 ${meta.ring} ${meta.text}`}><Icon className="size-6" /></span>
        <div>
          <p className={`text-lg font-bold ${meta.text}`}>{state === "valid" ? "Document verified" : verificationStateLabels[state]}</p>
          <p className="text-xs text-muted-foreground">{state === "valid" ? "This document is genuine and currently valid." : state === "not-found" || state === "invalid-token" ? "No matching document for this token." : `This document is ${verificationStateLabels[state].toLowerCase()}.`}</p>
        </div>
      </div>
      {record && (
        <dl className="grid grid-cols-2 gap-y-2 rounded-lg border border-border bg-surface p-sm text-sm">
          <dt className="text-muted-foreground">Type</dt><dd className="text-foreground">{documentTypeLabels[record.type]}</dd>
          <dt className="text-muted-foreground">Document No.</dt><dd className="font-medium text-foreground">{record.documentNumber}</dd>
          <dt className="text-muted-foreground">Holder</dt><dd className="text-foreground">{record.recipientName}</dd>
          {record.issuedDate && <><dt className="text-muted-foreground">Issued</dt><dd className="text-foreground">{formatDate(record.issuedDate)}</dd></>}
        </dl>
      )}
      <p className="text-[11px] text-muted-foreground">Only non-sensitive fields are shown. Personal contact, address and medical details are never exposed by verification.</p>
    </div>
  );
}
