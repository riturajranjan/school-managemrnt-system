import { Lock, ShieldCheck } from "lucide-react";

/** Banner shown atop health/counselling records to signal privacy awareness. */
export function PrivacyNotice({ kind = "health" }: { kind?: "health" | "counselling" }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-primary/25 bg-primary/5 p-sm text-xs text-foreground">
      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
      <p>
        <span className="font-medium">Sensitive {kind === "counselling" ? "counselling" : "health"} information.</span>{" "}
        Access is restricted to authorised staff and recorded for audit. All records are explicit entries — nothing here is inferred, diagnosed or predicted.
      </p>
    </div>
  );
}

/** Small badge marking a field/record as sensitive. */
export function SensitiveBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-pill bg-warning/12 px-2 py-0.5 text-[11px] font-medium text-warning">
      <Lock className="size-3" aria-hidden="true" /> Sensitive
    </span>
  );
}

/** Full-page restricted state for roles without sensitive-health access. */
export function RestrictedHealth({ label = "health information" }: { label?: string }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
      <span className="flex size-12 items-center justify-center rounded-pill bg-warning/10 text-warning">
        <Lock className="size-6" aria-hidden="true" />
      </span>
      <h1 className="text-base font-semibold text-foreground">Restricted {label}</h1>
      <p className="text-sm text-muted-foreground">
        You can see that this record exists, but the detail is restricted to authorised staff. An access reason and audit entry would be required to view it.
      </p>
    </div>
  );
}
