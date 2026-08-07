"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BedDouble, Search } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { bedStatusLabels, bedStatusTone, type HostelBed } from "@/lib/types/hostel";

export default function BedsPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [query, setQuery] = useState("");

  const roomOf = (roomId: string) => db.hostelRooms.find((r) => r.id === roomId);
  const buildingOf = (buildingId: string) => db.hostelBuildings.find((b) => b.id === buildingId);
  const studentName = (id?: string) => { const s = db.students.find((x) => x.id === id); return s ? `${s.profile.firstName} ${s.profile.lastName}` : "—"; };

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return db.hostelBeds.filter((b) => {
      if (!q) return true;
      const room = roomOf(b.roomId);
      return (room?.roomNumber ?? "").includes(q) || studentName(b.studentId).toLowerCase().includes(q);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db.hostelBeds, query]);

  if (!can("hostel.view")) return <PermissionDenied action="view beds" role={roleLabels[role]} backHref="/hostel" />;

  const columns: ColumnDef<HostelBed>[] = [
    { id: "bed", header: "Bed", alwaysVisible: true, cell: (b) => { const room = roomOf(b.roomId); const building = room ? buildingOf(room.buildingId) : undefined; return (
      <Link href={`/hostel/rooms/${b.roomId}`} className="min-w-0"><p className="text-sm font-medium text-foreground hover:underline">Room {room?.roomNumber} · Bed {b.position}</p><p className="truncate text-xs text-muted-foreground">{building?.code}</p></Link>
    ); } },
    { id: "occupant", header: "Occupant", cell: (b) => <span className="text-sm text-muted-foreground">{b.status === "occupied" ? studentName(b.studentId) : "—"}</span> },
    { id: "allocated", header: "Allocated", cell: (b) => <span className="text-xs text-muted-foreground">{b.allocationDate ?? "—"}</span>, defaultVisible: false },
    { id: "status", header: "Status", align: "right", cell: (b) => <Badge tone={bedStatusTone[b.status]}>{bedStatusLabels[b.status]}</Badge> },
  ];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Beds</h1>
        <p className="text-xs text-muted-foreground">{db.hostelBeds.length} beds · {db.hostelBeds.filter((b) => b.status === "occupied").length} occupied</p>
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search room or occupant…" className="pl-8" aria-label="Search beds" />
      </div>
      <DataTable columns={columns} rows={rows} getRowId={(b) => b.id} caption="Beds" isFiltered={query.trim() !== ""} emptyIcon={BedDouble} emptyTitle="No beds found"
        renderMobileCard={(b) => { const room = roomOf(b.roomId); return (
          <Link href={`/hostel/rooms/${b.roomId}`} className="surface-3d flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
            <div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">Room {room?.roomNumber} · Bed {b.position}</p><p className="truncate text-xs text-muted-foreground">{b.status === "occupied" ? studentName(b.studentId) : "Unoccupied"}</p></div>
            <Badge tone={bedStatusTone[b.status]}>{bedStatusLabels[b.status]}</Badge>
          </Link>
        ); }}
      />
    </div>
  );
}
