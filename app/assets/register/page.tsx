"use client";

// Asset register (Phase 9O) — real PostgreSQL/API cutover. No depreciation:
// `cost` is shown exactly as entered, never a fabricated "book value".
import Link from "next/link";
import { useMemo, useState } from "react";
import { HardDrive, Plus, Search } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useAssets } from "@/lib/hooks/api/use-assets-api";
import { roleLabels } from "@/lib/permissions/roles";
import type { AssetDto, AssetStatusDto } from "@/lib/api/contracts";

const statusTone: Record<AssetStatusDto, "success" | "warning" | "error" | "neutral" | "info"> = {
  available: "success", assigned: "info", maintenance: "warning", damaged: "error", lost: "error", retired: "neutral",
};
const statusLabels: Record<AssetStatusDto, string> = {
  available: "Available", assigned: "Assigned", maintenance: "Under maintenance", damaged: "Damaged", lost: "Lost", retired: "Retired",
};

export default function AssetRegisterPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const [query, setQuery] = useState("");
  const { data: assets, loading, error } = useAssets();

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assets.filter((a) => (q ? a.name.toLowerCase().includes(q) || a.assetTag.toLowerCase().includes(q) || (a.serialNumber ?? "").toLowerCase().includes(q) : true));
  }, [assets, query]);

  if (!capabilitiesLoading && !hasServerPermission("assets.view")) return <PermissionDenied action="view the asset register" role={roleLabels[role]} backHref="/" />;
  const canManage = hasServerPermission("assets.manage");

  const columns: ColumnDef<AssetDto>[] = [
    { id: "name", header: "Asset", alwaysVisible: true, sortValue: (a) => a.name, cell: (a) => (
      <Link href={`/assets/${a.id}`} className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground hover:underline">{a.name}</p>
        <p className="truncate text-xs text-muted-foreground">{a.assetTag} · {a.category ?? "Uncategorized"}</p>
      </Link>
    ) },
    { id: "location", header: "Holder / location", cell: (a) => <span className="text-sm text-muted-foreground">{a.assignedToName ?? a.locationName ?? "—"}</span> },
    { id: "cost", header: "Cost", align: "right", sortValue: (a) => a.cost ?? 0, cell: (a) => <span className="text-sm text-foreground">{a.cost !== null ? `₹${a.cost.toLocaleString("en-IN")}` : "—"}</span>, defaultVisible: false },
    { id: "status", header: "Status", align: "right", cell: (a) => <Badge tone={statusTone[a.status]}>{statusLabels[a.status]}</Badge> },
  ];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Asset register</h1>
          <p className="text-xs text-muted-foreground">{assets.length} assets</p>
        </div>
        {canManage && (
          <Button asChild size="sm">
            <Link href="/assets/register/new"><Plus className="size-3.5" /> Add asset</Link>
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search asset, tag or serial…" className="pl-8" aria-label="Search assets" />
      </div>

      {error ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">{error}</p>
      ) : loading && assets.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Loading…</p>
      ) : (
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
                <Badge tone={statusTone[a.status]}>{statusLabels[a.status]}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{a.assetTag} · {a.category ?? "Uncategorized"}</p>
              <p className="text-sm text-foreground">{a.assignedToName ?? a.locationName ?? "—"}</p>
            </Link>
          )}
        />
      )}
    </div>
  );
}
