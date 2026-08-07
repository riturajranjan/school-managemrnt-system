"use client";

import Link from "next/link";
import { Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { formatMoney, multiplyMoney } from "@/lib/finance/money";

export default function InventoryPurchasesPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  if (!can("inventory.view")) return <PermissionDenied action="view purchases" role={roleLabels[role]} backHref="/inventory" />;

  // Suggested purchase requests derived from live low-stock data — reuses the
  // Phase 5 procurement (purchase orders / vendors) architecture downstream.
  const suggestions = db.inventoryItems.filter((i) => i.quantity <= i.reorderLevel).map((i) => ({ item: i, qty: Math.max(0, i.maximumLevel - i.quantity) })).filter((s) => s.qty > 0);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Purchases & procurement</h1>
        <p className="text-xs text-muted-foreground">Purchase requests convert to Phase 5 purchase orders — no duplicate purchasing logic</p>
      </div>

      <div className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">Suggested purchase requests</h2>
        {suggestions.length === 0 ? (
          <p className="py-md text-center text-sm text-muted-foreground">Nothing needs reordering right now.</p>
        ) : (
          <div className="flex flex-col gap-sm">
            {suggestions.map(({ item, qty }) => (
              <div key={item.id} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm">
                <div className="min-w-0">
                  <Link href={`/inventory/items/${item.id}`} className="text-sm font-medium text-foreground hover:underline">{item.name}</Link>
                  <p className="text-xs text-muted-foreground">Order {qty} {item.unit} · est. {formatMoney(multiplyMoney(item.unitCost, qty), { compact: true })}</p>
                </div>
                <Badge tone="warning">Reorder</Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-surface p-md">
        <div className="mb-sm flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Existing requests</h2>
          <Link href="/accounting/purchase-orders" className="text-xs text-primary underline underline-offset-2">Purchase orders →</Link>
        </div>
        {db.inventoryPurchaseRequests.length === 0 ? (
          <div className="flex flex-col items-center gap-sm py-md text-center">
            <Truck className="size-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No purchase requests yet.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-sm">
            {db.inventoryPurchaseRequests.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm">
                <span className="text-sm text-foreground">{r.reference}</span>
                <Badge tone="info">{r.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
