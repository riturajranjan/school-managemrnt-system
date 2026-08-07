"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, Boxes, ClipboardList, TrendingDown, Warehouse } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useShell } from "@/components/shell/shell-context";
import { useSisStore } from "@/lib/hooks/use-store";
import { inventorySummary } from "@/lib/selectors/inventory-brief";
import { roleLabels } from "@/lib/permissions/roles";
import { formatMoney } from "@/lib/finance/money";
import { inventoryItemStatusLabels } from "@/lib/types/inventory";
import { formatDate } from "@/lib/utils";

export default function InventoryDashboardPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const { activeSession } = useShell();
  if (!can("inventory.view")) return <PermissionDenied action="view inventory" role={roleLabels[role]} backHref="/" />;

  const summary = inventorySummary(db);
  const today = new Date().toISOString().slice(0, 10);
  const reorder = db.inventoryItems.filter((i) => i.quantity <= i.reorderLevel).sort((a, b) => a.quantity - b.quantity).slice(0, 6);
  const recentMovements = [...db.inventoryMovements].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);
  const itemName = (id: string) => db.inventoryItems.find((i) => i.id === id)?.name ?? id;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Inventory Command Centre</h1>
        <p className="text-xs text-muted-foreground">Main branch · {activeSession} · {formatDate(today)}</p>
      </div>

      <section aria-label="Inventory summary" className="grid grid-cols-2 gap-sm sm:grid-cols-4 lg:grid-cols-4">
        <StatTile label="Total items" value={String(summary.totalItems)} icon={Boxes} tone="neutral" />
        <StatTile label="Stock value" value={formatMoney(summary.stockValue, { compact: true })} icon={Warehouse} tone="neutral" />
        <StatTile label="Low stock" value={String(summary.lowStock)} icon={TrendingDown} tone={summary.lowStock > 0 ? "warning" : "success"} />
        <StatTile label="Out of stock" value={String(summary.outOfStock)} icon={AlertTriangle} tone={summary.outOfStock > 0 ? "error" : "success"} />
        <StatTile label="Reorder needed" value={String(summary.reorderNeeded)} icon={TrendingDown} tone={summary.reorderNeeded > 0 ? "warning" : "success"} />
        <StatTile label="Pending issues" value={String(summary.pendingIssues)} icon={ClipboardList} tone="neutral" />
        <StatTile label="Categories" value={String(summary.categories)} icon={Boxes} tone="neutral" />
        <StatTile label="Damaged / expired" value={String(summary.damagedOrExpired)} icon={AlertTriangle} tone={summary.damagedOrExpired > 0 ? "warning" : "success"} />
      </section>

      <div className="grid grid-cols-1 gap-md lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-md">
          <div className="mb-sm flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Reorder soon</h2>
            <Link href="/inventory/low-stock" className="flex items-center gap-1 text-xs text-primary">View all <ArrowRight className="size-3" /></Link>
          </div>
          {reorder.length === 0 ? (
            <p className="py-md text-center text-sm text-muted-foreground">All items are above reorder level.</p>
          ) : (
            <ul className="flex flex-col gap-xs">
              {reorder.map((i) => (
                <li key={i.id}>
                  <Link href={`/inventory/items/${i.id}`} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm hover:border-primary/40">
                    <span className="truncate text-sm text-foreground">{i.name}</span>
                    <Badge tone={i.quantity === 0 ? "error" : "warning"}>{i.quantity} {i.unit} · {inventoryItemStatusLabels[i.status]}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm text-sm font-semibold text-foreground">Recent stock movements</h2>
          <ul className="flex flex-col gap-xs">
            {recentMovements.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-sm text-sm">
                <span className="truncate text-foreground">{itemName(m.itemId)}</span>
                <span className={`shrink-0 font-medium ${m.quantityDelta >= 0 ? "text-success" : "text-warning"}`}>
                  {m.quantityDelta >= 0 ? "+" : ""}{m.quantityDelta}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
