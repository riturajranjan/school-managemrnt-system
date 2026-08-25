"use client";

import { Building2, ShieldCheck } from "lucide-react";
import { useShell } from "@/components/shell/shell-context";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { roleLabels } from "@/lib/permissions/roles";
import { GPS_STALE_THRESHOLD_MINUTES } from "@/lib/types/gps";

export default function TransportSettingsPage() {
  const { activeBranchName, activeSession } = useShell();
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();

  if (!capabilitiesLoading && !hasServerPermission("transport.view")) {
    return <PermissionDenied action="view transport settings" role={roleLabels[role]} backHref="/transport" />;
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Transport settings</h1>
        <p className="text-xs text-muted-foreground">Branch, session and safety policy — read-only system info</p>
      </div>

      <div className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Building2 className="size-4" /> Branch &amp; session
        </h2>
        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Branch</dt>
          <dd className="text-foreground">{activeBranchName || "All branches"}</dd>
          <dt className="text-muted-foreground">Academic session</dt>
          <dd className="text-foreground">{activeSession}</dd>
        </dl>
        <p className="mt-sm text-xs text-muted-foreground">Switch these from the school/branch selector in the header — Transport data is scoped by whichever branch is active there.</p>
      </div>

      <div className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <ShieldCheck className="size-4" /> Safety policy
        </h2>
        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-muted-foreground">GPS staleness threshold</dt>
          <dd className="text-foreground">{GPS_STALE_THRESHOLD_MINUTES} minute(s)</dd>
        </dl>
        <p className="mt-sm text-xs text-muted-foreground">A vehicle&apos;s last GPS ping older than this is never shown as live. This is a system default, not yet a configurable setting.</p>
      </div>
    </div>
  );
}
