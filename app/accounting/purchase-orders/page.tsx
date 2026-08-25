"use client";

// Real PostgreSQL/API cutover (Production Accounting checkpoint) — reads/
// writes the live /api/accounting/purchase-orders endpoint. A PurchaseOrder
// is NOT a payment: creating or approving one never writes a JournalEntry,
// moves inventory, or implies goods receipt. V1 lifecycle only:
// DRAFT -> APPROVED, DRAFT -> CANCELLED — an APPROVED order is immutable
// (no cancel action once approved).
import { useState } from "react";
import { Check, ClipboardList, Plus, X } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef, RowAction } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/components/providers/permissions-provider";
import { approvePurchaseOrderRequest, cancelPurchaseOrderRequest, createPurchaseOrderRequest, usePurchaseOrder, usePurchaseOrders, useVendors } from "@/lib/hooks/api/use-accounting-api";
import type { PurchaseOrderListItemDto, PurchaseOrderStatusDto } from "@/lib/api/contracts";
import { formatCurrency, formatDate } from "@/lib/utils";

const statusLabels: Record<PurchaseOrderStatusDto, string> = { draft: "Draft", approved: "Approved", cancelled: "Cancelled" };
const statusTone: Record<PurchaseOrderStatusDto, "success" | "warning" | "error" | "neutral"> = { draft: "neutral", approved: "success", cancelled: "error" };

export default function PurchaseOrdersPage() {
  const { data: orders, loading, error, reload } = usePurchaseOrders({ pageSize: 100 });
  const { data: vendors } = useVendors({ status: "active", pageSize: 100 });
  const { can } = usePermissions();
  const canManage = can("accounting.manage");

  const [viewId, setViewId] = useState<string | null>(null);
  const { data: viewOrder, reload: reloadView } = usePurchaseOrder(viewId);

  const [createOpen, setCreateOpen] = useState(false);
  const [vendorId, setVendorId] = useState("");
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [itemDescription, setItemDescription] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [rate, setRate] = useState(100);
  const [taxPercent, setTaxPercent] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function resetForm() {
    setVendorId(""); setOrderDate(new Date().toISOString().slice(0, 10)); setItemDescription(""); setQuantity(1); setRate(100); setTaxPercent(0); setFormError(null);
  }

  const columns: ColumnDef<PurchaseOrderListItemDto>[] = [
    {
      id: "poNumber",
      header: "PO",
      alwaysVisible: true,
      sortValue: (po) => po.poNumber,
      cell: (po) => (
        <div>
          <p className="text-sm font-medium text-foreground">{po.poNumber}</p>
          <p className="text-xs text-muted-foreground">{po.vendorName}</p>
        </div>
      ),
    },
    { id: "items", header: "Items", cell: (po) => <span className="text-sm text-muted-foreground">{po.itemCount} item(s)</span> },
    { id: "total", header: "Total", align: "right", sortValue: (po) => po.totalAmount, cell: (po) => <span className="text-sm font-medium text-foreground">{formatCurrency(po.totalAmount)}</span> },
    { id: "delivery", header: "Delivery", cell: (po) => <span className="text-sm text-muted-foreground">{po.expectedDeliveryDate ? formatDate(po.expectedDeliveryDate) : "—"}</span>, defaultVisible: false },
    { id: "status", header: "Status", align: "right", cell: (po) => <Badge tone={statusTone[po.status]}>{statusLabels[po.status]}</Badge> },
  ];

  const rowActions: RowAction<PurchaseOrderListItemDto>[] = [
    { key: "view", label: "View details", icon: <ClipboardList className="size-3.5" />, onSelect: (po) => setViewId(po.id) },
    ...(canManage
      ? [
          { key: "approve", label: "Approve", icon: <Check className="size-3.5" />, hidden: (po: PurchaseOrderListItemDto) => po.status !== "draft", onSelect: (po: PurchaseOrderListItemDto) => approvePurchaseOrderRequest(po.id).then(reload) },
          { key: "cancel", label: "Cancel", icon: <X className="size-3.5" />, hidden: (po: PurchaseOrderListItemDto) => po.status !== "draft", destructive: true, onSelect: (po: PurchaseOrderListItemDto) => cancelPurchaseOrderRequest(po.id, { reason: "Cancelled by finance" }).then(reload) },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Purchase orders</h1>
          <p className="text-xs text-muted-foreground">Draft through approval — a purchase order never posts to the ledger by itself</p>
        </div>
        {canManage && (
          <Button
            size="sm"
            onClick={() => {
              resetForm();
              setCreateOpen(true);
            }}
          >
            <Plus className="size-3.5" />
            New purchase order
          </Button>
        )}
      </div>

      {error && <p className="rounded-md border border-error/30 bg-error/8 p-sm text-sm text-error">{error}</p>}
      {loading && orders.length === 0 && <p className="text-xs text-muted-foreground">Loading…</p>}

      <DataTable
        columns={columns}
        rows={orders}
        getRowId={(po) => po.id}
        caption="Purchase orders"
        rowActions={rowActions}
        renderMobileCard={(po) => (
          <button type="button" onClick={() => setViewId(po.id)} className="surface-3d flex w-full flex-col gap-1 rounded-lg border border-border bg-surface p-sm text-left">
            <div className="flex items-center justify-between gap-xs">
              <p className="truncate text-sm font-semibold text-foreground">{po.poNumber}</p>
              <Badge tone={statusTone[po.status]}>{statusLabels[po.status]}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {po.vendorName} · {po.itemCount} item(s)
            </p>
            <p className="text-sm font-medium text-foreground">{formatCurrency(po.totalAmount)}</p>
          </button>
        )}
        emptyIcon={ClipboardList}
        emptyTitle="No purchase orders yet"
      />

      <DetailDrawer open={!!viewId} onOpenChange={(open) => !open && setViewId(null)} title={viewOrder?.poNumber ?? ""} description={viewOrder ? `${viewOrder.vendorName} (${viewOrder.vendorCode})` : undefined}>
        {viewOrder && (
          <div className="flex flex-col gap-sm">
            <div className="flex flex-wrap items-center gap-xs text-xs text-muted-foreground">
              <span>{formatDate(viewOrder.orderDate)}</span>
              <span>·</span>
              <Badge tone={statusTone[viewOrder.status]}>{statusLabels[viewOrder.status]}</Badge>
            </div>
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-surface-secondary text-xs text-muted-foreground">
                  <tr>
                    <th className="p-xs text-left">Item</th>
                    <th className="p-xs text-right">Qty</th>
                    <th className="p-xs text-right">Rate</th>
                    <th className="p-xs text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {viewOrder.items.map((i) => (
                    <tr key={i.id} className="border-t border-border">
                      <td className="p-xs text-foreground">{i.description}</td>
                      <td className="p-xs text-right text-foreground">{i.quantity}</td>
                      <td className="p-xs text-right text-foreground">{formatCurrency(i.unitRate)}</td>
                      <td className="p-xs text-right text-foreground">{formatCurrency(i.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface-secondary p-sm text-sm">
              <div className="flex items-center justify-between text-muted-foreground"><span>Subtotal</span><span>{formatCurrency(viewOrder.subtotal)}</span></div>
              <div className="flex items-center justify-between text-muted-foreground"><span>Tax</span><span>{formatCurrency(viewOrder.taxTotal)}</span></div>
              {viewOrder.discountTotal > 0 && <div className="flex items-center justify-between text-muted-foreground"><span>Discount</span><span>-{formatCurrency(viewOrder.discountTotal)}</span></div>}
              <div className="flex items-center justify-between border-t border-border pt-1 font-medium text-foreground"><span>Total</span><span>{formatCurrency(viewOrder.totalAmount)}</span></div>
            </div>
            {viewOrder.status === "cancelled" && viewOrder.cancellationReason && <p className="text-xs text-error">Cancelled: {viewOrder.cancellationReason}</p>}
            {viewOrder.status === "approved" && <p className="text-xs text-muted-foreground">Approved by {viewOrder.approvedByName ?? "—"} on {viewOrder.approvedAt ? formatDate(viewOrder.approvedAt) : "—"}</p>}
            {canManage && viewOrder.status === "draft" && (
              <div className="flex gap-xs">
                <Button size="sm" onClick={() => approvePurchaseOrderRequest(viewOrder.id).then(() => { reload(); reloadView(); })}>
                  <Check className="size-3.5" />
                  Approve
                </Button>
                <Button size="sm" variant="secondary" onClick={() => cancelPurchaseOrderRequest(viewOrder.id, { reason: "Cancelled by finance" }).then(() => { reload(); reloadView(); })}>
                  <X className="size-3.5" />
                  Cancel
                </Button>
              </div>
            )}
          </div>
        )}
      </DetailDrawer>

      <DetailDrawer open={createOpen} onOpenChange={setCreateOpen} title="New purchase order" description="Created as a draft — approve it once it's ready">
        <div className="flex flex-col gap-sm">
          {formError && <p className="rounded-md border border-error/30 bg-error/8 p-sm text-sm text-error">{formError}</p>}
          <div className="grid grid-cols-2 gap-sm">
            <div>
              <Label>Vendor</Label>
              <Select value={vendorId} onValueChange={setVendorId}>
                <SelectTrigger aria-label="Vendor">
                  <SelectValue placeholder="Select vendor" />
                </SelectTrigger>
                <SelectContent>
                  {vendors.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="po-order-date">Order date</Label>
              <Input id="po-order-date" type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="po-item-desc">Item description</Label>
            <Input id="po-item-desc" value={itemDescription} onChange={(e) => setItemDescription(e.target.value)} placeholder="e.g. A4 notebooks (bulk)" />
          </div>
          <div className="grid grid-cols-3 gap-sm">
            <div>
              <Label htmlFor="po-qty">Quantity</Label>
              <Input id="po-qty" type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
            </div>
            <div>
              <Label htmlFor="po-rate">Rate (₹)</Label>
              <Input id="po-rate" type="number" min={0} value={rate} onChange={(e) => setRate(Number(e.target.value))} />
            </div>
            <div>
              <Label htmlFor="po-tax">Tax %</Label>
              <Input id="po-tax" type="number" min={0} max={100} value={taxPercent} onChange={(e) => setTaxPercent(Number(e.target.value))} />
            </div>
          </div>
          <Button
            disabled={!vendorId || !itemDescription.trim() || quantity <= 0 || saving}
            onClick={async () => {
              setFormError(null);
              setSaving(true);
              const res = await createPurchaseOrderRequest({
                vendorId, orderDate,
                items: [{ description: itemDescription.trim(), quantity, unitRate: rate, taxPercent }],
              });
              setSaving(false);
              if (!res.success) {
                setFormError(res.error.message);
                return;
              }
              setCreateOpen(false);
              resetForm();
              reload();
            }}
          >
            Create purchase order
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
