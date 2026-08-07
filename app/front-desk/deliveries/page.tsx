"use client";

import { useState } from "react";
import { Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { markDeliveryCollected } from "@/lib/services/communication-service";
import { roleLabels } from "@/lib/permissions/roles";
import { deliveryStatusLabels, type DeliveryStatus } from "@/lib/types/communication";

const tone: Record<DeliveryStatus, "success" | "warning" | "info" | "neutral"> = { received: "info", "awaiting-collection": "warning", collected: "success", returned: "neutral" };

export default function DeliveriesPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [, force] = useState(0);
  if (!can("frontdesk.view")) return <PermissionDenied action="view deliveries" role={roleLabels[role]} backHref="/front-desk" />;
  const canManage = can("frontdesk.manage");

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Deliveries</h1>
        <p className="text-xs text-muted-foreground">{db.deliveries.filter((d) => d.status !== "collected").length} awaiting collection</p>
      </div>

      {db.deliveries.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
          <Package className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No deliveries recorded.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-sm">
          {db.deliveries.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
              <div className="flex min-w-0 items-center gap-sm">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><Package className="size-4" /></span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{d.courier} · {d.packageCount} pkg</p>
                  <p className="truncate text-xs text-muted-foreground">From {d.sender} → {d.recipient} · arrived {d.arrivalTime}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-xs">
                <Badge tone={tone[d.status]}>{deliveryStatusLabels[d.status]}</Badge>
                {canManage && d.status !== "collected" && d.status !== "returned" && <Button size="sm" variant="outline" onClick={() => { markDeliveryCollected(d.id); force((n) => n + 1); }}>Mark collected</Button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
