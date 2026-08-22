"use client";

// Asset assignments (Phase 9O) — real PostgreSQL/API cutover.
import Link from "next/link";
import { useState } from "react";
import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { returnAssetRequest, useAssetAssignments } from "@/lib/hooks/api/use-assets-api";
import { roleLabels } from "@/lib/permissions/roles";
import { formatDate } from "@/lib/utils";

export default function AssetAssignmentsPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: active, reload } = useAssetAssignments({ status: "active" });
  const [busyId, setBusyId] = useState<string | null>(null);

  if (!capabilitiesLoading && !hasServerPermission("assets.view")) return <PermissionDenied action="view assignments" role={roleLabels[role]} backHref="/assets" />;
  const canAssign = hasServerPermission("assets.manage");

  async function handleReturn(assignmentId: string) {
    setBusyId(assignmentId);
    await returnAssetRequest(assignmentId);
    setBusyId(null);
    reload();
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Asset assignments</h1>
        <p className="text-xs text-muted-foreground">Active custody and handover tracking</p>
      </div>

      {active.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
          <Users className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No active assignments.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-sm">
          {active.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
              <div className="min-w-0">
                <Link href={`/assets/${a.assetId}`} className="truncate text-sm font-medium text-foreground hover:underline">{a.assetName}</Link>
                <p className="text-xs text-muted-foreground">{a.staffName} · since {formatDate(a.assignedAt)}</p>
              </div>
              <div className="flex items-center gap-xs">
                <Badge tone="info">Active</Badge>
                {canAssign && <Button size="sm" variant="outline" disabled={busyId === a.id} onClick={() => handleReturn(a.id)}>Return</Button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
