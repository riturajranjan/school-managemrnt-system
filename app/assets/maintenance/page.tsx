"use client";

import Link from "next/link";
import { useState } from "react";
import { Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { completeMaintenance } from "@/lib/services/asset-service";
import { roleLabels } from "@/lib/permissions/roles";
import { assetMaintenanceStatusLabels, maintenanceTypeLabels, type MaintenanceStatus } from "@/lib/types/assets";
import { formatMoney } from "@/lib/finance/money";
import { formatDate } from "@/lib/utils";

const tone: Record<MaintenanceStatus, "success" | "warning" | "error" | "info" | "neutral"> = {
  due: "warning",
  overdue: "error",
  "in-progress": "info",
  completed: "success",
  cancelled: "neutral",
};

export default function AssetMaintenancePage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const actor = { name: "Asset Manager", role: roleLabels[role] };
  const [, force] = useState(0);
  if (!can("assets.view")) return <PermissionDenied action="view maintenance" role={roleLabels[role]} backHref="/assets" />;
  const canManage = can("assets.manageMaintenance");

  const assetName = (id: string) => db.assets.find((a) => a.id === id)?.name ?? id;
  const rows = [...db.assetMaintenance].sort((a, b) => (a.status === "completed" ? 1 : 0) - (b.status === "completed" ? 1 : 0) || a.scheduledDate.localeCompare(b.scheduledDate));

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Asset maintenance</h1>
        <p className="text-xs text-muted-foreground">Preventive, repair and inspection schedule</p>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
          <Wrench className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No maintenance scheduled.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-sm">
          {rows.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
              <div className="min-w-0">
                <Link href={`/assets/${m.assetId}`} className="truncate text-sm font-medium text-foreground hover:underline">{assetName(m.assetId)}</Link>
                <p className="text-xs text-muted-foreground">{maintenanceTypeLabels[m.type]} · {formatDate(m.scheduledDate)}{m.cost ? ` · ${formatMoney(m.cost)}` : ""}{m.nextServiceDate ? ` · next ${formatDate(m.nextServiceDate)}` : ""}</p>
              </div>
              <div className="flex items-center gap-xs">
                <Badge tone={tone[m.status]}>{assetMaintenanceStatusLabels[m.status]}</Badge>
                {canManage && m.status !== "completed" && <Button size="sm" variant="outline" onClick={() => { completeMaintenance(m.id, actor, {}); force((n) => n + 1); }}>Complete</Button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
