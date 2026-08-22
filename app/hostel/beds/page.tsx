"use client";

// Beds (Phase 9Q) — real PostgreSQL/API cutover.
import Link from "next/link";
import { useState } from "react";
import { BedDouble, Search } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useHostelBeds } from "@/lib/hooks/api/use-hostel-api";
import { roleLabels } from "@/lib/permissions/roles";
import type { HostelBedDto, HostelMasterStatusDto } from "@/lib/api/contracts";

const statusTone: Record<HostelMasterStatusDto, "success" | "warning" | "neutral"> = { active: "success", maintenance: "warning", archived: "neutral" };

export default function BedsPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const [query, setQuery] = useState("");
  const { data: beds, loading, error } = useHostelBeds({ search: query || undefined });

  if (!capabilitiesLoading && !hasServerPermission("hostel.view")) return <PermissionDenied action="view beds" role={roleLabels[role]} backHref="/hostel" />;

  const columns: ColumnDef<HostelBedDto>[] = [
    { id: "bed", header: "Bed", alwaysVisible: true, cell: (b) => (
      <Link href={`/hostel/rooms/${b.roomId}`} className="min-w-0"><p className="text-sm font-medium text-foreground hover:underline">Room {b.roomNumber} · Bed {b.bedNumber}</p><p className="truncate text-xs text-muted-foreground">{b.hostelName}</p></Link>
    ) },
    { id: "occupant", header: "Occupant", cell: (b) => <span className="text-sm text-muted-foreground">{b.occupied ? b.occupantName : "—"}</span> },
    { id: "status", header: "Status", align: "right", cell: (b) => <Badge tone={b.occupied ? "info" : statusTone[b.status]}>{b.occupied ? "Occupied" : b.status}</Badge> },
  ];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Beds</h1>
        <p className="text-xs text-muted-foreground">{beds.length} beds · {beds.filter((b) => b.occupied).length} occupied</p>
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search room or occupant…" className="pl-8" aria-label="Search beds" />
      </div>
      {error ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">{error}</p>
      ) : loading && beds.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Loading…</p>
      ) : (
        <DataTable columns={columns} rows={beds} getRowId={(b) => b.id} caption="Beds" isFiltered={query.trim() !== ""} emptyIcon={BedDouble} emptyTitle="No beds found"
          renderMobileCard={(b) => (
            <Link href={`/hostel/rooms/${b.roomId}`} className="surface-3d flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
              <div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">Room {b.roomNumber} · Bed {b.bedNumber}</p><p className="truncate text-xs text-muted-foreground">{b.occupied ? b.occupantName : "Unoccupied"}</p></div>
              <Badge tone={b.occupied ? "info" : statusTone[b.status]}>{b.occupied ? "Occupied" : b.status}</Badge>
            </Link>
          )}
        />
      )}
    </div>
  );
}
