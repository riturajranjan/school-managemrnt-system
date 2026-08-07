"use client";

import { useMemo, useState } from "react";
import { ClipboardCheck, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { markHostelAttendance } from "@/lib/services/campus-service";
import { roleLabels } from "@/lib/permissions/roles";
import { hostelAttendanceStatusLabels, hostelAttendanceStatusTone, type HostelAttendanceStatus } from "@/lib/types/hostel";

export default function HostelAttendancePage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const today = new Date().toISOString().slice(0, 10);
  const [query, setQuery] = useState("");
  const [building, setBuilding] = useState("all");
  const [, force] = useState(0);

  const active = db.hostelAllocations.filter((a) => a.status === "active");
  const student = (id: string) => db.students.find((s) => s.id === id);
  const status = (sid: string): HostelAttendanceStatus => db.hostelAttendance.find((a) => a.studentId === sid && a.date === today)?.status ?? "not-checked-in";

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return active.filter((a) => (building === "all" ? true : a.buildingId === building)).filter((a) => { if (!q) return true; const s = student(a.studentId); return s ? `${s.profile.firstName} ${s.profile.lastName}`.toLowerCase().includes(q) : false; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, query, building]);

  if (!can("hostel.view")) return <PermissionDenied action="view hostel attendance" role={roleLabels[role]} backHref="/hostel" />;
  const canMark = can("hostel.attendance") || can("hostel.manage");

  const counts = { present: 0, leave: 0, notIn: 0 };
  rows.forEach((a) => { const st = status(a.studentId); if (st === "present") counts.present++; else if (st === "on-leave") counts.leave++; else if (st === "not-checked-in") counts.notIn++; });

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Hostel attendance</h1>
        <p className="text-xs text-muted-foreground">Tonight · {rows.length} residents · {counts.present} present, {counts.leave} on leave, {counts.notIn} not checked in</p>
      </div>
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center">
        <div className="relative flex-1"><Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search resident…" className="pl-8" aria-label="Search" /></div>
        <Select value={building} onValueChange={setBuilding}><SelectTrigger className="w-44" aria-label="Building"><SelectValue placeholder="Building" /></SelectTrigger><SelectContent><SelectItem value="all">All buildings</SelectItem>{db.hostelBuildings.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select>
      </div>
      <p className="text-xs text-muted-foreground">Hostel attendance is separate from academic attendance and never modifies it.</p>
      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center"><ClipboardCheck className="size-6 text-muted-foreground" /><p className="text-sm text-muted-foreground">No residents match.</p></div>
      ) : (
        <div className="flex flex-col gap-sm">
          {rows.map((a) => { const s = student(a.studentId); const st = status(a.studentId); return (
            <div key={a.id} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
              <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{s ? `${s.profile.firstName} ${s.profile.lastName}` : a.studentId}</p><p className="text-xs text-muted-foreground">{db.hostelBuildings.find((b) => b.id === a.buildingId)?.code} · {db.hostelRooms.find((r) => r.id === a.roomId)?.roomNumber}</p></div>
              {canMark ? (
                <Select value={st} onValueChange={(v) => { markHostelAttendance(a.studentId, today, v as HostelAttendanceStatus); force((n) => n + 1); }}><SelectTrigger className="w-40" aria-label={`Attendance for ${s?.profile.firstName}`}><SelectValue /></SelectTrigger><SelectContent>{(Object.keys(hostelAttendanceStatusLabels) as HostelAttendanceStatus[]).map((x) => <SelectItem key={x} value={x}>{hostelAttendanceStatusLabels[x]}</SelectItem>)}</SelectContent></Select>
              ) : <Badge tone={hostelAttendanceStatusTone[st]}>{hostelAttendanceStatusLabels[st]}</Badge>}
            </div>
          ); })}
        </div>
      )}
    </div>
  );
}
