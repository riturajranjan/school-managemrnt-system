"use client";

// App-wide impersonation banner (Super Admin SA-4K). Persistent, unmistakable
// notice shown whenever the current session is READ-ONLY inspecting a school as
// a platform admin. State is server-authoritative (from /api/auth/capabilities);
// this component only renders it and offers a server-backed "Stop". It never
// reads localStorage and grants no access.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Loader2, X } from "lucide-react";
import { usePermissions } from "@/components/providers/permissions-provider";

export function ImpersonationBanner() {
  const { impersonation, stopImpersonation } = usePermissions();
  const router = useRouter();
  const [stopping, setStopping] = useState(false);

  if (!impersonation.active) return null;

  const onStop = async () => {
    setStopping(true);
    try {
      await stopImpersonation();
      // Return the platform admin to their control center.
      router.push("/super-admin/dashboard");
    } finally {
      setStopping(false);
    }
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col gap-2 border-b border-warning/50 bg-warning/15 px-md py-2 text-sm text-warning-foreground sm:flex-row sm:items-center sm:justify-between"
    >
      <span className="flex items-center gap-2 font-medium text-foreground">
        <Eye className="size-4 shrink-0 text-warning" />
        Viewing <span className="font-semibold">{impersonation.school.name}</span> as Platform Admin
        <span className="rounded bg-warning/25 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-warning">
          Read-only inspection
        </span>
      </span>
      <button
        type="button"
        onClick={onStop}
        disabled={stopping}
        className="inline-flex items-center gap-1.5 self-start rounded-md border border-warning/60 bg-surface px-2.5 py-1 text-xs font-medium text-foreground transition hover:bg-warning/10 disabled:opacity-60 sm:self-auto"
      >
        {stopping ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
        Stop impersonating
      </button>
    </div>
  );
}
