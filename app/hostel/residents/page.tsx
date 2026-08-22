"use client";

// Residents (Phase 9Q) — real PostgreSQL/API cutover. "Tonight" status is the
// real roll call (NOT academic Attendance) for today's date.
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
import { useHostelAssignments, useHostelRollCall, useHostels } from "@/lib/hooks/api/use-hostel-api";
import { roleLabels } from "@/lib/permissions/roles";
import type { HostelAssignmentDto, HostelRollCallStatusDto } from "@/lib/api/contracts";

const rollCallTone: Record<HostelRollCallStatusDto, "success" | "warning" | "error" | "info" | "neutral"> = {
  present: "success", absent: "error", on_leave: "info", "not-marked": "neutral",
};
const rollCallLabel: Record<HostelRollCallStatusDto, string> = {
  present: "Present", absent: "Absent", on_leave: "On leave", "not-marked": "Not checked in",
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ResidentsPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const [query, setQuery] = useState("");
  const [hostelId, setHostelId] = useState("all");

  const { data: active } = useHostelAssignments({ status: "active", hostelId: hostelId === "all" ? undefined : hostelId });
  const { data: hostels } = useHostels();
  const { data: rollCall } = useHostelRollCall(today());
  const rollCallByStudent = new Map(rollCall.map((r) => [r.studentId, r.status]));

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return active.filter((a) => (q ? a.studentName.toLowerCase().includes(q) || a.admissionNumber.toLowerCase().includes(q) : true));
  }, [active, query]);

  if (!capabilitiesLoading && !hasServerPermission("hostel.view")) return <PermissionDenied action="view residents" role={roleLabels[role]} backHref="/hostel" />;

  const columns: ColumnDef<HostelAssignmentDto>[] = [
    { id: "student", header: "Resident", alwaysVisible: true, cell: (a) => (
      <Link href={`/hostel/residents/${a.studentId}`} className="min-w-0"><p className="truncate text-sm font-medium text-foreground hover:underline">{a.studentName}</p><p className="truncate text-xs text-muted-foreground">{a.admissionNumber}</p></Link>
    ) },
    { id: "room", header: "Room", cell: (a) => <span className="text-sm text-muted-foreground">{a.hostelName} · {a.roomNumber} · Bed {a.bedNumber}</span> },
    { id: "tonight", header: "Tonight", align: "right", cell: (a) => { const st = rollCallByStudent.get(a.studentId) ?? "not-marked"; return <Badge tone={rollCallTone[st]}>{rollCallLabel[st]}</Badge>; } },
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
        <Select value={hostelId} onValueChange={setHostelId}>
          <SelectTrigger className="w-44" aria-label="Hostel"><SelectValue placeholder="Hostel" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All hostels</SelectItem>{hostels.map((h) => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <DataTable columns={columns} rows={rows} getRowId={(a) => a.id} caption="Residents" isFiltered={query.trim() !== "" || hostelId !== "all"} emptyIcon={UsersRound} emptyTitle="No residents found"
        renderMobileCard={(a) => { const st = rollCallByStudent.get(a.studentId) ?? "not-marked"; return (
          <Link href={`/hostel/residents/${a.studentId}`} className="surface-3d flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
            <div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{a.studentName}</p><p className="truncate text-xs text-muted-foreground">{a.hostelName} · {a.roomNumber}</p></div>
            <Badge tone={rollCallTone[st]}>{rollCallLabel[st]}</Badge>
          </Link>
        ); }}
      />
    </div>
  );
}
