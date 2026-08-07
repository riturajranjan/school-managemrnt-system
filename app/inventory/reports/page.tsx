"use client";

import { Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MiniBar } from "@/components/dashboard/mini-charts";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { inventorySummary } from "@/lib/selectors/inventory-brief";
import { roleLabels } from "@/lib/permissions/roles";
import { addMoney, formatMoney, multiplyMoney, zeroMoney } from "@/lib/finance/money";
import { downloadTextFile } from "@/lib/utils";

export default function InventoryReportsPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  if (!can("inventory.viewReports")) return <PermissionDenied action="view inventory reports" role={roleLabels[role]} backHref="/inventory" />;

  const summary = inventorySummary(db);
  const byCategory = db.inventoryCategories.map((c) => {
    const items = db.inventoryItems.filter((i) => i.categoryId === c.id);
    const value = items.reduce((s, i) => addMoney(s, multiplyMoney(i.unitCost, i.quantity)), zeroMoney("INR"));
    return { name: c.name, count: items.length, value };
  });
  const maxValue = Math.max(1, ...byCategory.map((c) => c.value.minorUnits));

  function exportValuation() {
    const lines = ["Item,SKU,Category,Quantity,Unit cost,Stock value"];
    for (const i of db.inventoryItems) {
      const cat = db.inventoryCategories.find((c) => c.id === i.categoryId)?.name ?? "";
      lines.push([i.name, i.sku, cat, i.quantity, formatMoney(i.unitCost), formatMoney(multiplyMoney(i.unitCost, i.quantity))].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    }
    downloadTextFile("inventory-valuation.csv", lines.join("\n"));
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Inventory reports</h1>
          <p className="text-xs text-muted-foreground">Stock valuation, movement and low-stock analytics</p>
        </div>
        <Button size="sm" variant="outline" onClick={exportValuation}>
          <Download className="size-3.5" /> Export valuation
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <Tile label="Total items" value={String(summary.totalItems)} />
        <Tile label="Stock value" value={formatMoney(summary.stockValue, { compact: true })} />
        <Tile label="Low stock" value={String(summary.lowStock)} tone="text-warning" />
        <Tile label="Out of stock" value={String(summary.outOfStock)} tone="text-error" />
      </div>

      <div className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">Stock value by category</h2>
        <div className="flex flex-col gap-sm">
          {byCategory.map((c) => (
            <div key={c.name} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground">{c.name} <Badge tone="neutral">{c.count}</Badge></span>
                <span className="text-muted-foreground">{formatMoney(c.value, { compact: true })}</span>
              </div>
              <MiniBar percent={(c.value.minorUnits / maxValue) * 100} toneClassName="bg-primary" />
            </div>
          ))}
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
