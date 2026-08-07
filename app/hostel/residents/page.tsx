"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search, UsersRound } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { hostelAttendanceStatusLabels, hostelAttendanceStatusTone, type HostelAllocation } from "@/lib/types/hostel";

export default function ResidentsPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [query, setQuery] = useState("");
  const [building, setBuilding] = useState("all");
  const today = new Date().toISOString().slice(0, 10);

  const active = db.hostelAllocations.filter((a) => a.status === "active");
  const student = (id: string) => db.students.find((s) => s.id === id);
  const roomOf = (id: string) => db.hostelRooms.find((r) => r.id === id);
  const buildingOf = (id: string) => db.hostelBuildings.find((b) => b.id === id);
  const attStatus = (sid: string) => db.hostelAttendance.find((a) => a.studentId === sid && a.date === today)?.status ?? "not-checked-in";

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return active
      .filter((a) => (building === "all" ? true : a.buildingId === building))
      .filter((a) => { if (!q) return true; const s = student(a.studentId); return s ? `${s.profile.firstName} ${s.profile.lastName}`.toLowerCase().includes(q) || s.admissionNumber.toLowerCase().includes(q) : false; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, query, building]);

  if (!can("hostel.view")) return <PermissionDenied action="view residents" role={roleLabels[role]} backHref="/hostel" />;

  const columns: ColumnDef<HostelAllocation>[] = [
    { id: "student", header: "Resident", alwaysVisible: true, cell: (a) => { const s = student(a.studentId); return (
      <Link href={`/hostel/residents/${a.studentId}`} className="min-w-0"><p className="truncate text-sm font-medium text-foreground hover:underline">{s ? `${s.profile.firstName} ${s.profile.lastName}` : a.studentId}</p><p className="truncate text-xs text-muted-foreground">{s?.admissionNumber} · {s?.classId}</p></Link>
    ); } },
    { id: "room", header: "Room", cell: (a) => { const r = roomOf(a.roomId); return <span className="text-sm text-muted-foreground">{buildingOf(a.buildingId)?.code} · {r?.roomNumber} · Bed {db.hostelBeds.find((b) => b.id === a.bedId)?.position}</span>; } },
    { id: "attendance", header: "Tonight", align: "right", cell: (a) => { const st = attStatus(a.studentId); return <Badge tone={hostelAttendanceStatusTone[st]}>{hostelAttendanceStatusLabels[st]}</Badge>; } },
  ];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Residents</h1>
        <p className="text-xs text-muted-foreground">{active.length} boarders</p>
      </div>
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or admission no…" className="pl-8" aria-label="Search residents" />
        </div>
        <Select value={building} onValueChange={setBuilding}>
          <SelectTrigger className="w-44" aria-label="Building"><SelectValue placeholder="Building" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All buildings</SelectItem>{db.hostelBuildings.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <DataTable columns={columns} rows={rows} getRowId={(a) => a.id} caption="Residents" isFiltered={query.trim() !== "" || building !== "all"} emptyIcon={UsersRound} emptyTitle="No residents found"
        renderMobileCard={(a) => { const s = student(a.studentId); const r = roomOf(a.roomId); const st = attStatus(a.studentId); return (
          <Link href={`/hostel/residents/${a.studentId}`} className="surface-3d flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
            <div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{s ? `${s.profile.firstName} ${s.profile.lastName}` : a.studentId}</p><p className="truncate text-xs text-muted-foreground">{buildingOf(a.buildingId)?.code} · {r?.roomNumber}</p></div>
            <Badge tone={hostelAttendanceStatusTone[st]}>{hostelAttendanceStatusLabels[st]}</Badge>
          </Link>
        ); }}
      />
    </div>
  );
}
