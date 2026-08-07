"use client";

import { useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { transferStock } from "@/lib/services/inventory-service";
import { roleLabels } from "@/lib/permissions/roles";
import { transferStatusLabels } from "@/lib/types/inventory";
import { formatDate } from "@/lib/utils";

export default function InventoryTransfersPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const actor = { name: "Storekeeper", role: roleLabels[role] };
  const [itemId, setItemId] = useState(db.inventoryItems[0]?.id ?? "");
  const [qty, setQty] = useState("1");
  const [to, setTo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [, force] = useState(0);

  if (!can("inventory.view")) return <PermissionDenied action="view transfers" role={roleLabels[role]} backHref="/inventory" />;
  const canTransfer = can("inventory.transfer");
  const item = db.inventoryItems.find((i) => i.id === itemId);
  const itemName = (id: string) => db.inventoryItems.find((i) => i.id === id)?.name ?? id;

  function submit() {
    setError(null);
    if (!to.trim()) return setError("Destination location is required.");
    const r = transferStock(itemId, Number(qty) || 0, item?.storageLocation ?? "Store", to.trim(), actor);
    if (!r.ok) return setError(r.error);
    setTo("");
    setQty("1");
    force((n) => n + 1);
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Transfers</h1>
        <p className="text-xs text-muted-foreground">Move stock between storage locations — recorded as a balanced ledger pair</p>
      </div>

      {canTransfer && (
        <div className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
          <div className="grid grid-cols-1 gap-sm sm:grid-cols-3">
            <Select value={itemId} onValueChange={setItemId}>
              <SelectTrigger aria-label="Item"><SelectValue /></SelectTrigger>
              <SelectContent>{db.inventoryItems.map((i) => <SelectItem key={i.id} value={i.id}>{i.name} ({i.quantity})</SelectItem>)}</SelectContent>
            </Select>
            <Input type="number" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Qty" aria-label="Quantity" />
            <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Destination location" aria-label="Destination" />
          </div>
          {error && <p className="rounded-md border border-error/30 bg-error/8 p-sm text-sm text-error">{error}</p>}
          <div className="flex justify-end"><Button size="sm" onClick={submit}>Transfer</Button></div>
        </div>
      )}

      <div className="flex flex-col gap-sm">
        {db.inventoryTransfers.length === 0 ? (
          <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-xl text-center">
            <ArrowLeftRight className="size-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No transfers recorded yet.</p>
          </div>
        ) : (
          db.inventoryTransfers.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{itemName(t.itemId)} × {t.quantity}</p>
                <p className="text-xs text-muted-foreground">{t.fromLocation} → {t.toLocation} · {formatDate(t.createdAt)}</p>
              </div>
              <Badge tone="success">{transferStatusLabels[t.status]}</Badge>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
