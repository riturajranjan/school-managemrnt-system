"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { receiveStock } from "@/lib/services/inventory-service";
import { roleLabels } from "@/lib/permissions/roles";
import { inventoryItemStatusLabels } from "@/lib/types/inventory";

export default function LowStockPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const actor = { name: "Storekeeper", role: roleLabels[role] };
  const [, force] = useState(0);
  if (!can("inventory.view")) return <PermissionDenied action="view low stock" role={roleLabels[role]} backHref="/inventory" />;
  const canReceive = can("inventory.receive");

  const items = db.inventoryItems.filter((i) => i.quantity <= i.reorderLevel).sort((a, b) => a.quantity - b.quantity);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Low stock & reorder</h1>
        <p className="text-xs text-muted-foreground">Items at or below their reorder level</p>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
          <CheckCircle2 className="size-6 text-success" />
          <p className="text-sm text-muted-foreground">All items are above reorder level.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-sm">
          {items.map((i) => {
            const suggested = Math.max(0, i.maximumLevel - i.quantity);
            return (
              <div key={i.id} className="flex flex-col gap-xs rounded-lg border border-border bg-surface p-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <Link href={`/inventory/items/${i.id}`} className="text-sm font-medium text-foreground hover:underline">{i.name}</Link>
                  <p className="text-xs text-muted-foreground">On hand {i.quantity} · reorder at {i.reorderLevel} · suggested order {suggested}</p>
                </div>
                <div className="flex items-center gap-xs">
                  <Badge tone={i.quantity === 0 ? "error" : "warning"}>{inventoryItemStatusLabels[i.status]}</Badge>
                  {canReceive && suggested > 0 && (
                    <Button size="sm" variant="outline" onClick={() => { receiveStock(i.id, suggested, actor, { reference: "Reorder receipt" }); force((n) => n + 1); }}>Receive {suggested}</Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
