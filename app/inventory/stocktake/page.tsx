"use client";

// Inventory stocktake (Phase 9O) — real PostgreSQL/API cutover. A physical
// count that differs from the system quantity posts a real ADJUSTMENT
// movement — quantities never change without a movement record.
import { useState } from "react";
import { PackageSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { adjustStockRequest, useInventoryItems } from "@/lib/hooks/api/use-inventory-api";
import { roleLabels } from "@/lib/permissions/roles";

export default function InventoryStocktakePage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: items, reload } = useInventoryItems();
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  if (!capabilitiesLoading && !hasServerPermission("inventory.manage")) return <PermissionDenied action="run inventory stocktake" role={roleLabels[role]} backHref="/inventory" />;

  async function reconcile(itemId: string, expected: number) {
    const counted = Number(counts[itemId]);
    if (Number.isNaN(counted)) return;
    const variance = counted - expected;
    setBusyId(itemId);
    if (variance !== 0) await adjustStockRequest({ itemId, quantity: variance, reason: `Stocktake reconciliation (counted ${counted}, system ${expected})` });
    setBusyId(null);
    setCounts((c) => ({ ...c, [itemId]: "" }));
    reload();
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Inventory stocktake</h1>
        <p className="text-xs text-muted-foreground">Enter a physical count; variances post an adjustment movement to the ledger</p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="p-sm font-semibold">Item</th>
              <th className="p-sm text-right font-semibold">System</th>
              <th className="p-sm text-right font-semibold">Counted</th>
              <th className="p-sm text-right font-semibold">Variance</th>
              <th className="p-sm" />
            </tr>
          </thead>
          <tbody>
            {items.map((i) => {
              const counted = counts[i.id];
              const variance = counted !== undefined && counted !== "" ? Number(counted) - i.quantity : null;
              return (
                <tr key={i.id} className="border-b border-border last:border-0">
                  <td className="p-sm font-medium text-foreground">{i.name}</td>
                  <td className="p-sm text-right text-foreground">{i.quantity}</td>
                  <td className="p-sm text-right">
                    <Input type="number" inputMode="numeric" value={counted ?? ""} onChange={(e) => setCounts((c) => ({ ...c, [i.id]: e.target.value }))} className="ml-auto w-20 text-right" aria-label={`Counted quantity for ${i.name}`} />
                  </td>
                  <td className={`p-sm text-right font-medium ${variance === null ? "text-muted-foreground" : variance === 0 ? "text-success" : "text-warning"}`}>{variance === null ? "—" : variance > 0 ? `+${variance}` : variance}</td>
                  <td className="p-sm text-right">
                    <Button size="sm" variant="outline" disabled={counted === undefined || counted === "" || busyId === i.id} onClick={() => reconcile(i.id, i.quantity)}>Reconcile</Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="flex items-center gap-1 text-xs text-muted-foreground"><PackageSearch className="size-3.5" /> Quantities never change without a movement record.</p>
    </div>
  );
}
