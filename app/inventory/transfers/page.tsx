"use client";

// Inventory transfers (Phase 9O) — real PostgreSQL/API cutover. Atomic
// TRANSFER_OUT + TRANSFER_IN pair; insufficient source stock rolls back the
// whole transaction (no half-transfer).
import { useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { transferStockRequest, useInventoryItems, useInventoryLocations, useInventoryTransfers } from "@/lib/hooks/api/use-inventory-api";
import { roleLabels } from "@/lib/permissions/roles";
import { formatDate } from "@/lib/utils";

export default function InventoryTransfersPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: items } = useInventoryItems();
  const { data: locations } = useInventoryLocations();
  const { data: transfers, reload } = useInventoryTransfers();

  const [itemId, setItemId] = useState("");
  const [fromLocationId, setFromLocationId] = useState("");
  const [qty, setQty] = useState("1");
  const [to, setTo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!capabilitiesLoading && !hasServerPermission("inventory.view")) return <PermissionDenied action="view transfers" role={roleLabels[role]} backHref="/inventory" />;
  const canTransfer = hasServerPermission("inventory.manage");
  const effectiveItemId = itemId || items[0]?.id || "";
  const effectiveFromLocationId = fromLocationId || locations[0]?.id || "";

  async function submit() {
    setError(null);
    if (!to.trim()) return setError("Destination location is required.");
    if (!effectiveFromLocationId) return setError("Source location is required.");
    setBusy(true);
    const res = await transferStockRequest({ itemId: effectiveItemId, fromLocationId: effectiveFromLocationId, toLocationName: to.trim(), quantity: Number(qty) || 0 });
    setBusy(false);
    if (!res.success) return setError(res.error.message);
    setTo(""); setQty("1");
    reload();
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Transfers</h1>
        <p className="text-xs text-muted-foreground">Move stock between storage locations — recorded as a balanced ledger pair</p>
      </div>

      {canTransfer && (
        <div className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
          <div className="grid grid-cols-1 gap-sm sm:grid-cols-4">
            <Select value={effectiveItemId} onValueChange={setItemId}>
              <SelectTrigger aria-label="Item"><SelectValue /></SelectTrigger>
              <SelectContent>{items.map((i) => <SelectItem key={i.id} value={i.id}>{i.name} ({i.quantity})</SelectItem>)}</SelectContent>
            </Select>
            <Select value={effectiveFromLocationId} onValueChange={setFromLocationId}>
              <SelectTrigger aria-label="From location"><SelectValue placeholder="From" /></SelectTrigger>
              <SelectContent>{locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
            </Select>
            <Input type="number" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Qty" aria-label="Quantity" />
            <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Destination location" aria-label="Destination" />
          </div>
          {error && <p className="rounded-md border border-error/30 bg-error/8 p-sm text-sm text-error">{error}</p>}
          <div className="flex justify-end"><Button size="sm" onClick={submit} disabled={busy}>Transfer</Button></div>
        </div>
      )}

      <div className="flex flex-col gap-sm">
        {transfers.length === 0 ? (
          <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-xl text-center">
            <ArrowLeftRight className="size-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No transfers recorded yet.</p>
          </div>
        ) : (
          transfers.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{t.itemName} × {t.quantity}</p>
                <p className="text-xs text-muted-foreground">{t.fromLocationName} → {t.toLocationName} · {formatDate(t.createdAt)}</p>
              </div>
              <Badge tone="success">Completed</Badge>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
