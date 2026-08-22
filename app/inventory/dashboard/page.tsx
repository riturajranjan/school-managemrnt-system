"use client";

// Inventory Command Centre (Phase 9O) — real PostgreSQL/API cutover. DB-
// derived metrics only; no fabricated inventory value.
import Link from "next/link";
import { AlertTriangle, ArrowRight, Boxes, ClipboardList, TrendingDown, Warehouse } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useShell } from "@/components/shell/shell-context";
import { useInventoryDashboard, useInventoryMovements } from "@/lib/hooks/api/use-inventory-api";
import { roleLabels } from "@/lib/permissions/roles";
import { formatDate, formatDateTime } from "@/lib/utils";

export default function InventoryDashboardPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { activeSession } = useShell();
  const { data: summary } = useInventoryDashboard();
  const { data: recentMovements } = useInventoryMovements({ page: 1 });

  if (!capabilitiesLoading && !hasServerPermission("inventory.view")) return <PermissionDenied action="view inventory" role={roleLabels[role]} backHref="/" />;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Inventory Command Centre</h1>
        <p className="text-xs text-muted-foreground">{activeSession} · {formatDate(today)}</p>
      </div>

      <section aria-label="Inventory summary" className="grid grid-cols-2 gap-sm sm:grid-cols-4 lg:grid-cols-4">
        <StatTile label="Total items" value={String(summary?.totalItems ?? 0)} icon={Boxes} tone="neutral" />
        <StatTile label="Units on hand" value={String(summary?.totalUnitsOnHand ?? 0)} icon={Warehouse} tone="neutral" />
        <StatTile label="Low stock" value={String(summary?.lowStockCount ?? 0)} icon={TrendingDown} tone={(summary?.lowStockCount ?? 0) > 0 ? "warning" : "success"} />
        <StatTile label="Out of stock" value={String(summary?.outOfStockCount ?? 0)} icon={AlertTriangle} tone={(summary?.outOfStockCount ?? 0) > 0 ? "error" : "success"} />
      </section>

      <div className="grid grid-cols-1 gap-md lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-md">
          <div className="mb-sm flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Reorder alerts</h2>
            <Link href="/inventory/low-stock" className="flex items-center gap-1 text-xs text-primary hover:underline">View all <ArrowRight className="size-3" /></Link>
          </div>
          {(summary?.lowStockItems ?? []).length === 0 ? (
            <p className="py-md text-center text-sm text-muted-foreground">No items below reorder level.</p>
          ) : (
            <ul className="flex flex-col gap-xs">
              {summary!.lowStockItems.map((i) => (
                <li key={i.id}>
                  <Link href={`/inventory/items/${i.id}`} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm hover:border-primary/40">
                    <span className="truncate text-sm text-foreground">{i.name}</span>
                    <Badge tone={i.quantity <= 0 ? "error" : "warning"}>{i.quantity} on hand</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm flex items-center gap-1.5 text-sm font-semibold text-foreground"><ClipboardList className="size-4" /> Recent movements</h2>
          {recentMovements.length === 0 ? (
            <p className="py-md text-center text-sm text-muted-foreground">No movements yet.</p>
          ) : (
            <ul className="flex flex-col gap-xs">
              {recentMovements.slice(0, 6).map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-sm text-sm">
                  <span className="truncate text-foreground">{m.itemName}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{m.quantityDelta >= 0 ? "+" : ""}{m.quantityDelta} · {formatDateTime(m.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
