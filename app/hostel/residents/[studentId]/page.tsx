"use client";

// Hostel resident profile (Phase 9Q) — real PostgreSQL/API cutover.
// Attendance (roll call) is real and SEPARATE from academic Attendance.
// Leave/Visitors/Complaints have no real policy/infrastructure backing
// (parent-approval workflow, extended Visitor identity, shared ticketing) —
// they show an honest "not tracked yet" state instead of the old mock lists.
import Link from "next/link";
import { use } from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useHostelRollCallHistory, useStudentHostelProfile } from "@/lib/hooks/api/use-hostel-api";
import { useStudentDetail } from "@/lib/hooks/api/use-students";
import { roleLabels } from "@/lib/permissions/roles";
import { formatDate } from "@/lib/utils";

const rollCallTone: Record<string, "success" | "warning" | "error" | "info" | "neutral"> = { present: "success", absent: "error", on_leave: "info" };

export default function HostelResidentProfilePage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = use(params);
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: student, loading: studentLoading } = useStudentDetail(studentId);
  const { data: hostelProfile, loading } = useStudentHostelProfile(studentId);
  const { data: rollCallHistory } = useHostelRollCallHistory(studentId);

  if (!capabilitiesLoading && !hasServerPermission("hostel.view")) return <PermissionDenied action="view residents" role={roleLabels[role]} backHref="/hostel/residents" />;
  if (loading || studentLoading) return <p className="py-2xl text-center text-sm text-muted-foreground">Loading…</p>;
  if (!student) return <div className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Resident not found. <Link href="/hostel/residents" className="text-primary">Back</Link></div>;

  const current = hostelProfile?.current ?? null;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-sm">
        <Button asChild size="icon" variant="ghost" aria-label="Back"><Link href="/hostel/residents"><ArrowLeft className="size-4" /></Link></Button>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold text-foreground">{student.firstName} {student.lastName}</h1>
          <p className="truncate text-xs text-muted-foreground">{student.admissionNumber}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <Metric label="Hostel" value={current?.hostelName ?? "—"} />
        <Metric label="Room" value={current?.roomNumber ?? "—"} />
        <Metric label="Bed" value={current?.bedNumber ?? "—"} />
        <Metric label="Warden" value={current?.wardenName ?? "—"} />
      </div>
      <div className="flex flex-wrap gap-xs">
        {hasServerPermission("hostel.manage") && <Button asChild size="sm" variant="outline"><Link href="/hostel/allocations">Change room / bed</Link></Button>}
        <Button asChild size="sm" variant="ghost"><Link href={`/students/${student.id}`}><ExternalLink className="size-3.5" /> Full student profile</Link></Button>
      </div>

      <Tabs defaultValue="attendance">
        <TabsList className="flex-wrap">
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="leave">Leave</TabsTrigger>
          <TabsTrigger value="visitors">Visitors</TabsTrigger>
          <TabsTrigger value="complaints">Complaints</TabsTrigger>
        </TabsList>
        <TabsContent value="attendance" className="mt-md">
          {rollCallHistory.length === 0 ? <Empty message="No roll call records." /> : (
            <div className="flex flex-col gap-xs">
              {rollCallHistory.slice(0, 15).map((a) => (
                <div key={a.date} className="flex items-center justify-between gap-sm rounded-md border border-border bg-surface p-sm text-sm">
                  <span className="text-foreground">{formatDate(a.date)}</span>
                  <Badge tone={rollCallTone[a.status] ?? "neutral"}>{a.status.replace("_", " ")}</Badge>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="leave" className="mt-md"><Empty message="Not tracked in this system yet — no real parent-approval workflow exists." /></TabsContent>
        <TabsContent value="visitors" className="mt-md"><Empty message="Not tracked in this system yet." /></TabsContent>
        <TabsContent value="complaints" className="mt-md"><Empty message="Not tracked in this system yet." /></TabsContent>
      </Tabs>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-border bg-surface p-sm"><p className="text-xs text-muted-foreground">{label}</p><p className="truncate text-sm font-semibold text-foreground">{value}</p></div>;
}
function Empty({ message }: { message: string }) { return <div className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">{message}</div>; }
