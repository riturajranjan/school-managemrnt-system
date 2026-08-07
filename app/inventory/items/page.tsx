"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Boxes, Plus, Search } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { inventoryItemStatusLabels, type InventoryItem, type InventoryItemStatus } from "@/lib/types/inventory";
import { formatMoney, multiplyMoney } from "@/lib/finance/money";

const statusTone: Record<InventoryItemStatus, "success" | "warning" | "error" | "neutral"> = {
  "in-stock": "success",
  "low-stock": "warning",
  "out-of-stock": "error",
  expired: "error",
  damaged: "error",
  discontinued: "neutral",
};

export default function InventoryItemsPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return db.inventoryItems.filter((i) => (q ? i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q) : true));
  }, [db.inventoryItems, query]);

  if (!can("inventory.view")) return <PermissionDenied action="view inventory items" role={roleLabels[role]} backHref="/" />;
  const canManage = can("inventory.manageItems");
  const categoryName = (id: string) => db.inventoryCategories.find((c) => c.id === id)?.name ?? "—";

  const columns: ColumnDef<InventoryItem>[] = [
    { id: "name", header: "Item", alwaysVisible: true, sortValue: (i) => i.name, cell: (i) => (
      <Link href={`/inventory/items/${i.id}`} className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground hover:underline">{i.name}</p>
        <p className="truncate text-xs text-muted-foreground">{i.sku} · {categoryName(i.categoryId)}</p>
      </Link>
    ) },
    { id: "qty", header: "Quantity", align: "right", sortValue: (i) => i.quantity, cell: (i) => <span className={`text-sm font-medium ${i.quantity <= i.reorderLevel ? "text-warning" : "text-foreground"}`}>{i.quantity} {i.unit}</span> },
    { id: "value", header: "Value", align: "right", cell: (i) => <span className="text-sm text-muted-foreground">{formatMoney(multiplyMoney(i.unitCost, i.quantity), { compact: true })}</span>, defaultVisible: false },
    { id: "status", header: "Status", align: "right", cell: (i) => <Badge tone={statusTone[i.status]}>{inventoryItemStatusLabels[i.status]}</Badge> },
  ];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Inventory items</h1>
          <p className="text-xs text-muted-foreground">{db.inventoryItems.length} items · live quantities from the movement ledger</p>
        </div>
        {canManage && (
          <Button asChild size="sm">
            <Link href="/inventory/items/new">
              <Plus className="size-3.5" /> Add item
            </Link>
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search item or SKU…" className="pl-8" aria-label="Search items" />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(i) => i.id}
        caption="Inventory items"
        isFiltered={query.trim() !== ""}
        emptyIcon={Boxes}
        emptyTitle="No items found"
        renderMobileCard={(i) => (
          <Link href={`/inventory/items/${i.id}`} className="surface-3d flex flex-col gap-1 rounded-lg border border-border bg-surface p-sm">
            <div className="flex items-center justify-between gap-xs">
              <p className="truncate text-sm font-semibold text-foreground">{i.name}</p>
              <Badge tone={statusTone[i.status]}>{inventoryItemStatusLabels[i.status]}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{i.sku} · {categoryName(i.categoryId)}</p>
            <p className={`text-sm font-medium ${i.quantity <= i.reorderLevel ? "text-warning" : "text-foreground"}`}>{i.quantity} {i.unit}</p>
          </Link>
        )}
      />
    </div>
  );
}
