"use client";

// Low stock & reorder (Phase 9O) — real PostgreSQL/API cutover. Derived
// only: lowStock = quantity <= reorderLevel. No fake reorder suggestions.
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useInventoryItems } from "@/lib/hooks/api/use-inventory-api";
import { roleLabels } from "@/lib/permissions/roles";

export default function LowStockPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: items } = useInventoryItems({ status: "low-stock" });
  const { data: outOfStock } = useInventoryItems({ status: "out-of-stock" });

  if (!capabilitiesLoading && !hasServerPermission("inventory.view")) return <PermissionDenied action="view low stock" role={roleLabels[role]} backHref="/inventory" />;
  const canReceive = hasServerPermission("inventory.manage");

  const rows = [...items, ...outOfStock].sort((a, b) => a.quantity - b.quantity);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Low stock & reorder</h1>
        <p className="text-xs text-muted-foreground">Items at or below their reorder level</p>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
          <CheckCircle2 className="size-6 text-success" />
          <p className="text-sm text-muted-foreground">All items are above reorder level.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-sm">
          {rows.map((i) => (
            <div key={i.id} className="flex flex-col gap-xs rounded-lg border border-border bg-surface p-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <Link href={`/inventory/items/${i.id}`} className="text-sm font-medium text-foreground hover:underline">{i.name}</Link>
                <p className="text-xs text-muted-foreground">On hand {i.quantity} · reorder at {i.reorderLevel ?? "—"}</p>
              </div>
              <div className="flex items-center gap-xs">
                <Badge tone={i.quantity === 0 ? "error" : "warning"}>{i.quantity === 0 ? "Out of stock" : "Low stock"}</Badge>
                {canReceive && (
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/inventory/items/${i.id}`}>Receive</Link>
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
