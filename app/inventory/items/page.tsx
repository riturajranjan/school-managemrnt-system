"use client";

// Inventory items (Phase 9O) — real PostgreSQL/API cutover.
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
import { useInventoryItems } from "@/lib/hooks/api/use-inventory-api";
import { roleLabels } from "@/lib/permissions/roles";
import type { InventoryItemDto, InventoryItemStatusDto } from "@/lib/api/contracts";

const statusTone: Record<InventoryItemStatusDto, "success" | "warning" | "error" | "neutral"> = {
  "in-stock": "success",
  "low-stock": "warning",
  "out-of-stock": "error",
  discontinued: "neutral",
};
const statusLabels: Record<InventoryItemStatusDto, string> = {
  "in-stock": "In stock",
  "low-stock": "Low stock",
  "out-of-stock": "Out of stock",
  discontinued: "Discontinued",
};

export default function InventoryItemsPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const [query, setQuery] = useState("");
  const { data: items, loading, error } = useInventoryItems();

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => (q ? i.name.toLowerCase().includes(q) || i.code.toLowerCase().includes(q) : true));
  }, [items, query]);

  if (!capabilitiesLoading && !hasServerPermission("inventory.view")) return <PermissionDenied action="view inventory items" role={roleLabels[role]} backHref="/inventory" />;
  const canManage = hasServerPermission("inventory.manage");

  const columns: ColumnDef<InventoryItemDto>[] = [
    { id: "name", header: "Item", alwaysVisible: true, sortValue: (i) => i.name, cell: (i) => (
      <Link href={`/inventory/items/${i.id}`} className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground hover:underline">{i.name}</p>
        <p className="truncate text-xs text-muted-foreground">{i.code} · {i.category ?? "Uncategorized"}</p>
      </Link>
    ) },
    { id: "qty", header: "Quantity", align: "right", sortValue: (i) => i.quantity, cell: (i) => <span className={`text-sm font-medium ${i.status === "low-stock" || i.status === "out-of-stock" ? "text-warning" : "text-foreground"}`}>{i.quantity} {i.unit}</span> },
    { id: "status", header: "Status", align: "right", cell: (i) => <Badge tone={statusTone[i.status]}>{statusLabels[i.status]}</Badge> },
  ];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Inventory items</h1>
          <p className="text-xs text-muted-foreground">{items.length} items · live quantities from the movement ledger</p>
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
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search item or code…" className="pl-8" aria-label="Search items" />
      </div>

      {error ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">{error}</p>
      ) : loading && items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Loading…</p>
      ) : (
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
                <Badge tone={statusTone[i.status]}>{statusLabels[i.status]}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{i.code} · {i.category ?? "Uncategorized"}</p>
              <p className={`text-sm font-medium ${i.status === "low-stock" || i.status === "out-of-stock" ? "text-warning" : "text-foreground"}`}>{i.quantity} {i.unit}</p>
            </Link>
          )}
        />
      )}
    </div>
  );
}
