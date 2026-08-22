"use client";

// Inventory item detail (Phase 9O) — real PostgreSQL/API cutover. The
// movement ledger IS the audit trail for this item — no separate mock
// "audit history" section (it had zero real backing).
import Link from "next/link";
import { use, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { adjustStockRequest, issueStockRequest, receiveStockRequest, useInventoryItem, useInventoryItemMovements } from "@/lib/hooks/api/use-inventory-api";
import { roleLabels } from "@/lib/permissions/roles";
import type { InventoryItemStatusDto, InventoryMovementTypeDto } from "@/lib/api/contracts";
import { formatDateTime } from "@/lib/utils";

const statusLabels: Record<InventoryItemStatusDto, string> = {
  "in-stock": "In stock", "low-stock": "Low stock", "out-of-stock": "Out of stock", discontinued: "Discontinued",
};
const movementLabels: Record<InventoryMovementTypeDto, string> = {
  opening: "Opening", receipt: "Receipt", issue: "Issue", return: "Return",
  "transfer-out": "Transfer out", "transfer-in": "Transfer in", "adjustment-in": "Adjustment", "adjustment-out": "Adjustment",
};

export default function InventoryItemPage({ params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = use(params);
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: item, loading, reload } = useInventoryItem(itemId);
  const { data: movements, reload: reloadMovements } = useInventoryItemMovements(itemId);
  const [qty, setQty] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!capabilitiesLoading && !hasServerPermission("inventory.view")) return <PermissionDenied action="view inventory items" role={roleLabels[role]} backHref="/inventory" />;
  if (!loading && !item) {
    return (
      <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
        <p className="text-sm font-medium text-foreground">Item not found</p>
        <Button asChild size="sm" variant="outline"><Link href="/inventory/items">Back to items</Link></Button>
      </div>
    );
  }
  if (!item) return null;

  const n = Number(qty) || 0;

  async function act(fn: () => Promise<{ success: boolean; error?: { message: string } }>) {
    setError(null);
    setBusy(true);
    const r = await fn();
    setBusy(false);
    if (!r.success) setError(r.error?.message ?? "Action failed.");
    else setQty("");
    reload();
    reloadMovements();
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-sm">
        <Button asChild size="icon" variant="ghost" aria-label="Back to items"><Link href="/inventory/items"><ArrowLeft className="size-4" /></Link></Button>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold text-foreground">{item.name}</h1>
          <p className="truncate text-xs text-muted-foreground">{item.code} · {item.category ?? "Uncategorized"}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-3">
        <Metric label="On hand" value={`${item.quantity} ${item.unit}`} tone={item.status === "low-stock" || item.status === "out-of-stock" ? "text-warning" : "text-foreground"} />
        <Metric label="Reorder at" value={item.reorderLevel !== null ? String(item.reorderLevel) : "Not tracked"} />
        <Metric label="Status" value={statusLabels[item.status]} />
      </div>

      {(hasServerPermission("inventory.manage")) && (
        <div className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm text-sm font-semibold text-foreground">Stock actions</h2>
          <div className="flex flex-col gap-sm sm:flex-row sm:items-end">
            <div className="sm:w-40">
              <label className="mb-1 block text-xs text-muted-foreground">Quantity</label>
              <Input type="number" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" aria-label="Quantity" disabled={busy} />
            </div>
            <div className="flex flex-wrap gap-xs">
              <Button size="sm" variant="outline" disabled={n <= 0 || busy} onClick={() => act(() => receiveStockRequest({ itemId: item.id, quantity: n }))}>Receive</Button>
              <Button size="sm" variant="outline" disabled={n <= 0 || busy} onClick={() => act(() => issueStockRequest({ itemId: item.id, quantity: n, recipientKind: "other", recipientLabel: "General store issue", returnable: false }))}>Issue</Button>
              <Button size="sm" variant="ghost" disabled={n === 0 || busy} onClick={() => act(() => adjustStockRequest({ itemId: item.id, quantity: n, reason: "Manual adjustment" }))}>Adjust (+/−)</Button>
            </div>
          </div>
          {error && <p className="mt-sm rounded-md border border-error/30 bg-error/8 p-sm text-sm text-error">{error}</p>}
        </div>
      )}

      <div className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">Movement ledger</h2>
        <div className="flex flex-col gap-xs">
          {(movements ?? []).length === 0 && <p className="py-md text-center text-sm text-muted-foreground">No movements yet.</p>}
          {(movements ?? []).map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{movementLabels[m.movementType]}</p>
                <p className="truncate text-xs text-muted-foreground">{m.locationName}{m.notes ? ` · ${m.notes}` : ""} · {formatDateTime(m.createdAt)}</p>
              </div>
              <div className="text-right">
                <p className={`text-sm font-semibold ${m.quantityDelta >= 0 ? "text-success" : "text-warning"}`}>{m.quantityDelta >= 0 ? "+" : ""}{m.quantityDelta}</p>
              </div>
            </div>
          ))}
        </div>
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
