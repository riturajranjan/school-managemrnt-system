"use client";

import Link from "next/link";
import { use } from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { hostelAttendanceStatusLabels, hostelAttendanceStatusTone, hostelLeaveStatusLabels, hostelLeaveStatusTone, hostelLeaveTypeLabels, hostelVisitorStatusLabels } from "@/lib/types/hostel";
import { formatDate } from "@/lib/utils";

export default function HostelResidentProfilePage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = use(params);
  const db = useSisStore();
  const { can, role } = usePermissions();

  const student = db.students.find((s) => s.id === studentId);
  if (!can("hostel.view")) return <PermissionDenied action="view residents" role={roleLabels[role]} backHref="/hostel/residents" />;
  if (!student) return <div className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Resident not found. <Link href="/hostel/residents" className="text-primary">Back</Link></div>;

  const alloc = db.hostelAllocations.find((a) => a.studentId === studentId && a.status === "active");
  const room = alloc ? db.hostelRooms.find((r) => r.id === alloc.roomId) : undefined;
  const building = alloc ? db.hostelBuildings.find((b) => b.id === alloc.buildingId) : undefined;
  const bed = alloc ? db.hostelBeds.find((b) => b.id === alloc.bedId) : undefined;
  const attendance = db.hostelAttendance.filter((a) => a.studentId === studentId).sort((a, b) => b.date.localeCompare(a.date));
  const leave = db.hostelLeave.filter((l) => l.studentId === studentId);
  const visitors = db.hostelVisitors.filter((v) => v.studentId === studentId);
  const complaints = db.hostelComplaints.filter((c) => c.studentId === studentId);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-sm">
        <Button asChild size="icon" variant="ghost" aria-label="Back"><Link href="/hostel/residents"><ArrowLeft className="size-4" /></Link></Button>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold text-foreground">{student.profile.firstName} {student.profile.lastName}</h1>
          <p className="truncate text-xs text-muted-foreground">{student.admissionNumber} · {student.classId}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <Metric label="Building" value={building?.name ?? "—"} />
        <Metric label="Room" value={room?.roomNumber ?? "—"} />
        <Metric label="Bed" value={bed?.position ?? "—"} />
        <Metric label="Warden" value={building?.wardenName ?? "—"} />
      </div>
      <div className="flex flex-wrap gap-xs">
        {can("hostel.allocate") && <Button asChild size="sm" variant="outline"><Link href="/hostel/allocations">Change room / bed</Link></Button>}
        <Button asChild size="sm" variant="ghost"><Link href={`/students/${student.id}`}><ExternalLink className="size-3.5" /> Full student profile</Link></Button>
      </div>

      <Tabs defaultValue="attendance">
        <TabsList className="flex-wrap">
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="leave">Leave ({leave.length})</TabsTrigger>
          <TabsTrigger value="visitors">Visitors ({visitors.length})</TabsTrigger>
          <TabsTrigger value="complaints">Complaints ({complaints.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="attendance" className="mt-md">
          {attendance.length === 0 ? <Empty /> : <div className="flex flex-col gap-xs">{attendance.slice(0, 15).map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-sm rounded-md border border-border bg-surface p-sm text-sm"><span className="text-foreground">{formatDate(a.date)}</span><Badge tone={hostelAttendanceStatusTone[a.status]}>{hostelAttendanceStatusLabels[a.status]}</Badge></div>
          ))}</div>}
        </TabsContent>
        <TabsContent value="leave" className="mt-md">
          {leave.length === 0 ? <Empty /> : <div className="flex flex-col gap-xs">{leave.map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-sm rounded-md border border-border bg-surface p-sm text-sm"><span className="min-w-0 truncate text-foreground">{hostelLeaveTypeLabels[l.type]} · {formatDate(l.fromDate)}→{formatDate(l.toDate)}</span><Badge tone={hostelLeaveStatusTone[l.status]}>{hostelLeaveStatusLabels[l.status]}</Badge></div>
          ))}</div>}
        </TabsContent>
        <TabsContent value="visitors" className="mt-md">
          {visitors.length === 0 ? <Empty /> : <div className="flex flex-col gap-xs">{visitors.map((v) => (
            <div key={v.id} className="flex items-center justify-between gap-sm rounded-md border border-border bg-surface p-sm text-sm"><span className="min-w-0 truncate text-foreground">{v.visitorName} ({v.relation})</span><Badge tone="neutral">{hostelVisitorStatusLabels[v.status]}</Badge></div>
          ))}</div>}
        </TabsContent>
        <TabsContent value="complaints" className="mt-md">
          {complaints.length === 0 ? <Empty /> : <div className="flex flex-col gap-xs">{complaints.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-sm rounded-md border border-border bg-surface p-sm text-sm"><span className="min-w-0 truncate text-foreground">{c.description}</span><Badge tone="neutral">{c.status}</Badge></div>
          ))}</div>}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-border bg-surface p-sm"><p className="text-xs text-muted-foreground">{label}</p><p className="truncate text-sm font-semibold text-foreground">{value}</p></div>;
}
function Empty() { return <div className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No records.</div>; }
