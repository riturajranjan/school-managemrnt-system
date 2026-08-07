"use client";

import Link from "next/link";
import { use, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResourceAuditTrail } from "@/components/library/resource-audit-trail";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { adjustStock, issueStock, receiveStock } from "@/lib/services/inventory-service";
import { roleLabels } from "@/lib/permissions/roles";
import { inventoryItemStatusLabels, movementTypeLabels } from "@/lib/types/inventory";
import { formatMoney, multiplyMoney } from "@/lib/finance/money";
import { formatDateTime } from "@/lib/utils";

export default function InventoryItemPage({ params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = use(params);
  const db = useSisStore();
  const { can, role } = usePermissions();
  const actor = { name: "Storekeeper", role: roleLabels[role] };
  const [qty, setQty] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [, force] = useState(0);

  const item = db.inventoryItems.find((i) => i.id === itemId);
  if (!can("inventory.view")) return <PermissionDenied action="view inventory items" role={roleLabels[role]} backHref="/inventory" />;
  if (!item) {
    return (
      <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
        <p className="text-sm font-medium text-foreground">Item not found</p>
        <Button asChild size="sm" variant="outline"><Link href="/inventory/items">Back to items</Link></Button>
      </div>
    );
  }

  const movements = db.inventoryMovements.filter((m) => m.itemId === item.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const categoryName = db.inventoryCategories.find((c) => c.id === item.categoryId)?.name ?? "—";
  const n = Number(qty) || 0;

  function act(fn: () => { ok: boolean; error?: string }) {
    setError(null);
    const r = fn();
    if (!r.ok) setError(r.error ?? "Action failed.");
    else setQty("");
    force((x) => x + 1);
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-sm">
        <Button asChild size="icon" variant="ghost" aria-label="Back to items"><Link href="/inventory/items"><ArrowLeft className="size-4" /></Link></Button>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold text-foreground">{item.name}</h1>
          <p className="truncate text-xs text-muted-foreground">{item.sku} · {categoryName}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <Metric label="On hand" value={`${item.quantity} ${item.unit}`} tone={item.quantity <= item.reorderLevel ? "text-warning" : "text-foreground"} />
        <Metric label="Reorder at" value={`${item.reorderLevel}`} />
        <Metric label="Unit cost" value={formatMoney(item.unitCost)} />
        <Metric label="Stock value" value={formatMoney(multiplyMoney(item.unitCost, item.quantity), { compact: true })} />
      </div>
      <Badge tone={item.status === "in-stock" ? "success" : item.status === "out-of-stock" ? "error" : "warning"}>{inventoryItemStatusLabels[item.status]}</Badge>

      {(can("inventory.receive") || can("inventory.issue") || can("inventory.adjust")) && (
        <div className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm text-sm font-semibold text-foreground">Stock actions</h2>
          <div className="flex flex-col gap-sm sm:flex-row sm:items-end">
            <div className="sm:w-40">
              <label className="mb-1 block text-xs text-muted-foreground">Quantity</label>
              <Input type="number" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" aria-label="Quantity" />
            </div>
            <div className="flex flex-wrap gap-xs">
              {can("inventory.receive") && <Button size="sm" variant="outline" disabled={n <= 0} onClick={() => act(() => receiveStock(item.id, n, actor))}>Receive</Button>}
              {can("inventory.issue") && <Button size="sm" variant="outline" disabled={n <= 0} onClick={() => act(() => issueStock({ itemId: item.id, quantity: n, recipientType: "department", recipientName: "General store issue", returnable: false }, actor))}>Issue</Button>}
              {can("inventory.adjust") && <Button size="sm" variant="ghost" disabled={n === 0} onClick={() => act(() => adjustStock(item.id, n, actor, "Manual adjustment"))}>Adjust (+/−)</Button>}
            </div>
          </div>
          {error && <p className="mt-sm rounded-md border border-error/30 bg-error/8 p-sm text-sm text-error">{error}</p>}
        </div>
      )}

      <div className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">Movement ledger</h2>
        <div className="flex flex-col gap-xs">
          {movements.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{movementTypeLabels[m.type]}</p>
                <p className="truncate text-xs text-muted-foreground">{m.reference ?? "—"} · {formatDateTime(m.createdAt)}</p>
              </div>
              <div className="text-right">
                <p className={`text-sm font-semibold ${m.quantityDelta >= 0 ? "text-success" : "text-warning"}`}>{m.quantityDelta >= 0 ? "+" : ""}{m.quantityDelta}</p>
                <p className="text-xs text-muted-foreground">bal {m.balanceAfter}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">Audit history</h2>
        <ResourceAuditTrail domain="inventory" subjectId={item.id} />
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm font-semibold ${tone ?? "text-foreground"}`}>{value}</p>
    </div>
  );
}
