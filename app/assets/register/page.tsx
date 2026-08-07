"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { HardDrive, Search } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { currentBookValue } from "@/lib/selectors/asset-depreciation";
import { roleLabels } from "@/lib/permissions/roles";
import { assetStatusLabels, assetTypeLabels, type Asset, type AssetStatus } from "@/lib/types/assets";
import { formatMoney } from "@/lib/finance/money";

const statusTone: Record<AssetStatus, "success" | "warning" | "error" | "neutral" | "info"> = {
  available: "success",
  assigned: "info",
  "in-use": "info",
  maintenance: "warning",
  damaged: "error",
  lost: "error",
  retired: "neutral",
  disposed: "neutral",
};

export default function AssetRegisterPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return db.assets.filter((a) => (q ? a.name.toLowerCase().includes(q) || a.assetTag.toLowerCase().includes(q) || (a.serialNumber ?? "").toLowerCase().includes(q) : true));
  }, [db.assets, query]);

  if (!can("assets.view")) return <PermissionDenied action="view the asset register" role={roleLabels[role]} backHref="/" />;
  const categoryName = (id: string) => db.assetCategories.find((c) => c.id === id)?.name ?? "—";

  const columns: ColumnDef<Asset>[] = [
    { id: "name", header: "Asset", alwaysVisible: true, sortValue: (a) => a.name, cell: (a) => (
      <Link href={`/assets/${a.id}`} className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground hover:underline">{a.name}</p>
        <p className="truncate text-xs text-muted-foreground">{a.assetTag} · {categoryName(a.categoryId)}</p>
      </Link>
    ) },
    { id: "type", header: "Type", cell: (a) => <Badge tone="neutral">{assetTypeLabels[a.type]}</Badge>, defaultVisible: false },
    { id: "location", header: "Location", cell: (a) => <span className="text-sm text-muted-foreground">{a.assignedToName ?? a.location}</span> },
    { id: "book", header: "Book value", align: "right", sortValue: (a) => currentBookValue(a).minorUnits, cell: (a) => <span className="text-sm text-foreground">{formatMoney(currentBookValue(a), { compact: true })}</span> },
    { id: "status", header: "Status", align: "right", cell: (a) => <Badge tone={statusTone[a.status]}>{assetStatusLabels[a.status]}</Badge> },
  ];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Asset register</h1>
        <p className="text-xs text-muted-foreground">{db.assets.length} assets · live book value</p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search asset, tag or serial…" className="pl-8" aria-label="Search assets" />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(a) => a.id}
        caption="Asset register"
        isFiltered={query.trim() !== ""}
        emptyIcon={HardDrive}
        emptyTitle="No assets found"
        renderMobileCard={(a) => (
          <Link href={`/assets/${a.id}`} className="surface-3d flex flex-col gap-1 rounded-lg border border-border bg-surface p-sm">
            <div className="flex items-center justify-between gap-xs">
              <p className="truncate text-sm font-semibold text-foreground">{a.name}</p>
              <Badge tone={statusTone[a.status]}>{assetStatusLabels[a.status]}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{a.assetTag} · {categoryName(a.categoryId)}</p>
            <p className="text-sm text-foreground">{formatMoney(currentBookValue(a), { compact: true })} · {a.assignedToName ?? a.location}</p>
          </Link>
        )}
      />
    </div>
  );
}
