"use client";

import Link from "next/link";
import { useState } from "react";
import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { returnAsset } from "@/lib/services/asset-service";
import { roleLabels } from "@/lib/permissions/roles";
import { assignmentStatusLabels, assignmentTargetTypeLabels } from "@/lib/types/assets";
import { formatDate } from "@/lib/utils";

export default function AssetAssignmentsPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const actor = { name: "Asset Manager", role: roleLabels[role] };
  const [, force] = useState(0);
  if (!can("assets.view")) return <PermissionDenied action="view assignments" role={roleLabels[role]} backHref="/assets" />;
  const canAssign = can("assets.assign");

  const active = db.assetAssignments.filter((a) => a.status === "active");
  const assetName = (id: string) => db.assets.find((x) => x.id === id)?.name ?? id;

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
                <Link href={`/assets/${a.assetId}`} className="truncate text-sm font-medium text-foreground hover:underline">{assetName(a.assetId)}</Link>
                <p className="text-xs text-muted-foreground">{assignmentTargetTypeLabels[a.targetType]} · {a.targetName} · since {formatDate(a.assignedAt)}{a.acknowledged ? " · acknowledged" : ""}</p>
              </div>
              <div className="flex items-center gap-xs">
                <Badge tone="info">{assignmentStatusLabels[a.status]}</Badge>
                {canAssign && <Button size="sm" variant="outline" onClick={() => { returnAsset(a.id, actor, "good"); force((n) => n + 1); }}>Return</Button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
