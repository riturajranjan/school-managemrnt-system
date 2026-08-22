"use client";

// Asset maintenance (Phase 9O) — real PostgreSQL/API cutover. Structurally
// simple, non-financial-workflow records — no procurement/accounting.
import Link from "next/link";
import { useState } from "react";
import { Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { completeMaintenanceRequest, useAssetMaintenance } from "@/lib/hooks/api/use-assets-api";
import { roleLabels } from "@/lib/permissions/roles";
import type { AssetMaintenanceStatusDto } from "@/lib/api/contracts";
import { formatDate } from "@/lib/utils";

const tone: Record<AssetMaintenanceStatusDto, "success" | "warning" | "info" | "neutral"> = {
  open: "warning", "in-progress": "info", completed: "success", cancelled: "neutral",
};

export default function AssetMaintenancePage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: rows, reload } = useAssetMaintenance();
  const [busyId, setBusyId] = useState<string | null>(null);

  if (!capabilitiesLoading && !hasServerPermission("assets.view")) return <PermissionDenied action="view maintenance" role={roleLabels[role]} backHref="/assets" />;
  const canManage = hasServerPermission("assets.manage");

  const sorted = [...rows].sort((a, b) => (a.status === "completed" ? 1 : 0) - (b.status === "completed" ? 1 : 0) || a.openedAt.localeCompare(b.openedAt));

  async function complete(id: string) {
    setBusyId(id);
    await completeMaintenanceRequest(id);
    setBusyId(null);
    reload();
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Asset maintenance</h1>
        <p className="text-xs text-muted-foreground">Preventive, repair and inspection records</p>
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
          <Wrench className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No maintenance scheduled.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-sm">
          {sorted.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
              <div className="min-w-0">
                <Link href={`/assets/${m.assetId}`} className="truncate text-sm font-medium text-foreground hover:underline">{m.assetName}</Link>
                <p className="text-xs text-muted-foreground">{m.description} · {formatDate(m.openedAt)}{m.cost !== null ? ` · ₹${m.cost.toLocaleString("en-IN")}` : ""}</p>
              </div>
              <div className="flex items-center gap-xs">
                <Badge tone={tone[m.status]}>{m.status}</Badge>
                {canManage && (m.status === "open" || m.status === "in-progress") && <Button size="sm" variant="outline" disabled={busyId === m.id} onClick={() => complete(m.id)}>Complete</Button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
