"use client";

import { useState } from "react";
import { ArrowRight, Check, ClipboardList, Plus, X } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef, RowAction } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { formatMoney, moneyFromMajor, zeroMoney } from "@/lib/finance/money";
import { advancePurchaseOrder, approvePurchaseOrder, cancelPurchaseOrder, createPurchaseOrder, purchaseOrderTotal, submitPurchaseOrder } from "@/lib/services/purchase-order-service";
import { purchaseOrderStatusLabels, type PurchaseOrder, type PurchaseOrderStatus } from "@/lib/types/accounting";
import { formatDate } from "@/lib/utils";

const ACTOR = { name: "Finance Administrator", role: "Finance Administrator" };

const statusTone: Record<PurchaseOrderStatus, "success" | "warning" | "error" | "neutral"> = {
  draft: "neutral",
  submitted: "warning",
  approved: "neutral",
  ordered: "warning",
  "partially-received": "warning",
  received: "neutral",
  invoiced: "warning",
  paid: "success",
  cancelled: "error",
};

const nextStatusLabel: Partial<Record<PurchaseOrderStatus, string>> = {
  approved: "Mark ordered",
  ordered: "Mark partially received",
  "partially-received": "Mark received",
  received: "Mark invoiced",
  invoiced: "Mark paid",
};

export default function PurchaseOrdersPage() {
  const db = useSisStore();
  const { can } = usePermissions();
  const canManage = can("accounting.managePurchaseOrders");
  const canApprove = can("accounting.approvePurchaseOrders");

  const [createOpen, setCreateOpen] = useState(false);
  const [vendorId, setVendorId] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [rate, setRate] = useState(100);
  const [taxPercent, setTaxPercent] = useState(0);

  function vendorName(id: string) {
    return db.vendors.find((v) => v.id === id)?.name ?? id;
  }

  const columns: ColumnDef<PurchaseOrder>[] = [
    {
      id: "poNumber",
      header: "PO",
      alwaysVisible: true,
      sortValue: (po) => po.poNumber,
      cell: (po) => (
        <div>
          <p className="text-sm font-medium text-foreground">{po.poNumber}</p>
          <p className="text-xs text-muted-foreground">{vendorName(po.vendorId)}</p>
        </div>
      ),
    },
    { id: "items", header: "Items", cell: (po) => <span className="text-sm text-muted-foreground">{po.items.length} item(s)</span> },
    { id: "total", header: "Total", align: "right", sortValue: (po) => purchaseOrderTotal(po).minorUnits, cell: (po) => <span className="text-sm font-medium text-foreground">{formatMoney(purchaseOrderTotal(po))}</span> },
    { id: "delivery", header: "Delivery", cell: (po) => <span className="text-sm text-muted-foreground">{po.deliveryDate ? formatDate(po.deliveryDate) : "—"}</span>, defaultVisible: false },
    { id: "status", header: "Status", align: "right", cell: (po) => <Badge tone={statusTone[po.status]}>{purchaseOrderStatusLabels[po.status]}</Badge> },
  ];

  const rowActions: RowAction<PurchaseOrder>[] = [
    ...(canManage ? [{ key: "submit", label: "Submit for approval", icon: <ArrowRight className="size-3.5" />, hidden: (po: PurchaseOrder) => po.status !== "draft", onSelect: (po: PurchaseOrder) => submitPurchaseOrder(po.id, ACTOR) }] : []),
    ...(canApprove
      ? [
          { key: "approve", label: "Approve", icon: <Check className="size-3.5" />, hidden: (po: PurchaseOrder) => po.status !== "submitted", onSelect: (po: PurchaseOrder) => approvePurchaseOrder(po.id, ACTOR) },
          { key: "advance", label: "Advance status", icon: <ArrowRight className="size-3.5" />, hidden: (po: PurchaseOrder) => !nextStatusLabel[po.status], onSelect: (po: PurchaseOrder) => advancePurchaseOrder(po.id, ACTOR) },
        ]
      : []),
    ...(canManage
      ? [{ key: "cancel", label: "Cancel", icon: <X className="size-3.5" />, hidden: (po: PurchaseOrder) => po.status === "paid" || po.status === "cancelled", destructive: true, onSelect: (po: PurchaseOrder) => cancelPurchaseOrder(po.id, "Cancelled by finance", ACTOR) }]
      : []),
  ];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Purchase orders</h1>
          <p className="text-xs text-muted-foreground">PO workflow from draft through payment, linked to expenses</p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" />
            New purchase order
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={[...db.purchaseOrders].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))}
        getRowId={(po) => po.id}
        caption="Purchase orders"
        rowActions={rowActions}
        renderMobileCard={(po) => (
          <div className="surface-3d flex flex-col gap-1 rounded-lg border border-border bg-surface p-sm">
            <div className="flex items-center justify-between gap-xs">
              <p className="truncate text-sm font-semibold text-foreground">{po.poNumber}</p>
              <Badge tone={statusTone[po.status]}>{purchaseOrderStatusLabels[po.status]}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {vendorName(po.vendorId)} · {po.items.length} item(s)
            </p>
            <p className="text-sm font-medium text-foreground">{formatMoney(purchaseOrderTotal(po))}</p>
          </div>
        )}
        emptyIcon={ClipboardList}
        emptyTitle="No purchase orders yet"
      />

      <DetailDrawer open={createOpen} onOpenChange={setCreateOpen} title="New purchase order" description="Single-item POs can be extended with more items later">
        <div className="flex flex-col gap-sm">
          <div>
            <Label>Vendor</Label>
            <Select value={vendorId} onValueChange={setVendorId}>
              <SelectTrigger aria-label="Vendor">
                <SelectValue placeholder="Select vendor" />
              </SelectTrigger>
              <SelectContent>
                {db.vendors
                  .filter((v) => v.status === "active")
                  .map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
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
            disabled={!vendorId || !itemDescription.trim() || quantity <= 0}
            onClick={() => {
              createPurchaseOrder(
                {
                  vendorId,
                  items: [{ id: `poi-${Date.now()}`, description: itemDescription.trim(), quantity, rate: moneyFromMajor(rate, "INR"), taxPercent }],
                  discount: zeroMoney("INR"),
                  branch: "main",
                },
                ACTOR,
              );
              setCreateOpen(false);
              setVendorId("");
              setItemDescription("");
              setQuantity(1);
              setRate(100);
              setTaxPercent(0);
            }}
          >
            Create purchase order
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
