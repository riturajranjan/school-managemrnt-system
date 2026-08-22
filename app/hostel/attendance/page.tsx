"use client";

// Hostel attendance / nightly roll call (Phase 9Q) — real PostgreSQL/API
// cutover. A SEPARATE domain from academic Attendance — never modifies it.
import { useMemo, useState } from "react";
import { ClipboardCheck, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { markHostelRollCallRequest, useHostelRollCall, useHostels } from "@/lib/hooks/api/use-hostel-api";
import { roleLabels } from "@/lib/permissions/roles";
import type { HostelRollCallStatusDto } from "@/lib/api/contracts";

const statusLabels: Record<"present" | "absent" | "on_leave", string> = { present: "Present", absent: "Absent", on_leave: "On leave" };
const rollCallTone: Record<HostelRollCallStatusDto, "success" | "warning" | "error" | "info" | "neutral"> = { present: "success", absent: "error", on_leave: "info", "not-marked": "neutral" };
const rollCallLabel: Record<HostelRollCallStatusDto, string> = { present: "Present", absent: "Absent", on_leave: "On leave", "not-marked": "Not checked in" };

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function HostelAttendancePage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const [query, setQuery] = useState("");
  const [hostelId, setHostelId] = useState("all");
  const date = today();

  const { data: rollCall, reload } = useHostelRollCall(date, hostelId === "all" ? undefined : hostelId);
  const { data: hostels } = useHostels();

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rollCall.filter((r) => (q ? r.studentName.toLowerCase().includes(q) : true));
  }, [rollCall, query]);

  if (!capabilitiesLoading && !hasServerPermission("hostel.view")) return <PermissionDenied action="view hostel attendance" role={roleLabels[role]} backHref="/hostel" />;
  const canMark = hasServerPermission("hostel.manage");

  const counts = { present: 0, leave: 0, notIn: 0 };
  rows.forEach((r) => { if (r.status === "present") counts.present++; else if (r.status === "on_leave") counts.leave++; else if (r.status === "not-marked") counts.notIn++; });

  async function mark(studentId: string, status: "present" | "absent" | "on_leave") {
    await markHostelRollCallRequest({ studentId, date, status });
    reload();
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Hostel attendance</h1>
        <p className="text-xs text-muted-foreground">Tonight · {rows.length} residents · {counts.present} present, {counts.leave} on leave, {counts.notIn} not checked in</p>
      </div>
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center">
        <div className="relative flex-1"><Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search resident…" className="pl-8" aria-label="Search" /></div>
        <Select value={hostelId} onValueChange={setHostelId}><SelectTrigger className="w-44" aria-label="Hostel"><SelectValue placeholder="Hostel" /></SelectTrigger><SelectContent><SelectItem value="all">All hostels</SelectItem>{hostels.map((h) => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}</SelectContent></Select>
      </div>
      <p className="text-xs text-muted-foreground">Hostel attendance is separate from academic attendance and never modifies it.</p>
      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center"><ClipboardCheck className="size-6 text-muted-foreground" /><p className="text-sm text-muted-foreground">No residents match.</p></div>
      ) : (
        <div className="flex flex-col gap-sm">
          {rows.map((r) => (
            <div key={r.studentId} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
              <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{r.studentName}</p><p className="text-xs text-muted-foreground">{r.hostelName} · {r.roomNumber}</p></div>
              {canMark ? (
                <Select value={r.status === "not-marked" ? undefined : r.status} onValueChange={(v) => mark(r.studentId, v as "present" | "absent" | "on_leave")}>
                  <SelectTrigger className="w-40" aria-label={`Attendance for ${r.studentName}`}><SelectValue placeholder="Not checked in" /></SelectTrigger>
                  <SelectContent>{(Object.keys(statusLabels) as ("present" | "absent" | "on_leave")[]).map((x) => <SelectItem key={x} value={x}>{statusLabels[x]}</SelectItem>)}</SelectContent>
                </Select>
              ) : <Badge tone={rollCallTone[r.status]}>{rollCallLabel[r.status]}</Badge>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
