"use client";

// Inventory reports (Phase 9O) — real PostgreSQL/API cutover. Stock-on-hand
// and low-stock are real; valuation/procurement-spend reports are dropped —
// no real cost/procurement basis exists (an item has no admin-entered unit
// cost in this phase).
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MiniBar } from "@/components/dashboard/mini-charts";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useInventoryDashboard, useInventoryItems } from "@/lib/hooks/api/use-inventory-api";
import { roleLabels } from "@/lib/permissions/roles";
import { downloadTextFile } from "@/lib/utils";

export default function InventoryReportsPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: summary } = useInventoryDashboard();
  const { data: items } = useInventoryItems();

  if (!capabilitiesLoading && !hasServerPermission("inventory.view")) return <PermissionDenied action="view inventory reports" role={roleLabels[role]} backHref="/inventory" />;

  const byCategory = Object.entries(
    items.reduce<Record<string, number>>((acc, i) => {
      const key = i.category ?? "Uncategorized";
      acc[key] = (acc[key] ?? 0) + i.quantity;
      return acc;
    }, {}),
  ).map(([name, units]) => ({ name, units })).sort((a, b) => b.units - a.units);
  const maxUnits = Math.max(1, ...byCategory.map((c) => c.units));

  function exportStockOnHand() {
    const lines = ["Item,Code,Category,Quantity,Unit,Status"];
    for (const i of items) {
      lines.push([i.name, i.code, i.category ?? "", i.quantity, i.unit, i.status].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    }
    downloadTextFile("inventory-stock-on-hand.csv", lines.join("\n"));
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Inventory reports</h1>
          <p className="text-xs text-muted-foreground">Stock-on-hand, low-stock and movement analytics</p>
        </div>
        <Button size="sm" variant="outline" onClick={exportStockOnHand}>
          <Download className="size-3.5" /> Export stock-on-hand
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <Tile label="Total items" value={String(summary?.totalItems ?? 0)} />
        <Tile label="Units on hand" value={String(summary?.totalUnitsOnHand ?? 0)} />
        <Tile label="Low stock" value={String(summary?.lowStockCount ?? 0)} tone="text-warning" />
        <Tile label="Out of stock" value={String(summary?.outOfStockCount ?? 0)} tone="text-error" />
      </div>

      <div className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">Units on hand by category</h2>
        <div className="flex flex-col gap-sm">
          {byCategory.length === 0 ? (
            <p className="py-md text-center text-sm text-muted-foreground">No items yet.</p>
          ) : (
            byCategory.map((c) => (
              <div key={c.name} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{c.name}</span>
                  <span className="text-muted-foreground">{c.units} units</span>
                </div>
                <MiniBar percent={(c.units / maxUnits) * 100} toneClassName="bg-primary" />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold ${tone ?? "text-foreground"}`}>{value}</p>
    </div>
  );
}
