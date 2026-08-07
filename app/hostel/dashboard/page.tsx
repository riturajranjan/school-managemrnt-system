"use client";

import Link from "next/link";
import { BedDouble, CalendarDays, ClipboardList, MessageSquareWarning, UserPlus, UsersRound, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { useShell } from "@/components/shell/shell-context";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { hostelSummary } from "@/lib/selectors/campus-brief";
import { roleLabels } from "@/lib/permissions/roles";
import { hostelLeaveStatusLabels, hostelLeaveStatusTone, complaintStatusTone, complaintCategoryLabels } from "@/lib/types/hostel";
import { formatDate } from "@/lib/utils";

export default function HostelDashboardPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const { activeSession } = useShell();
  if (!can("hostel.view")) return <PermissionDenied action="view the hostel command centre" role={roleLabels[role]} backHref="/hostel" />;

  const today = new Date().toISOString().slice(0, 10);
  const s = hostelSummary(db);
  const studentName = (id: string) => { const st = db.students.find((x) => x.id === id); return st ? `${st.profile.firstName} ${st.profile.lastName}` : id; };
  const leaveToReview = db.hostelLeave.filter((l) => l.status === "requested" || l.status === "parent-confirmed").slice(0, 6);
  const recentComplaints = db.hostelComplaints.filter((c) => c.status !== "resolved" && c.status !== "closed").slice(0, 6);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Hostel Command Centre</h1>
          <p className="text-xs text-muted-foreground">{activeSession} · {formatDate(today)}</p>
        </div>
        {can("hostel.manage") && (
          <div className="flex flex-wrap gap-xs">
            <Button asChild size="sm"><Link href="/hostel/allocations"><UserPlus className="size-3.5" /> Allocate bed</Link></Button>
            <Button asChild size="sm" variant="outline"><Link href="/hostel/attendance"><ClipboardList className="size-3.5" /> Attendance</Link></Button>
            <Button asChild size="sm" variant="outline"><Link href="/hostel/visitors"><UsersRound className="size-3.5" /> Visitors</Link></Button>
          </div>
        )}
      </div>

      <section className="grid grid-cols-2 gap-sm sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Capacity" value={String(s.capacity)} icon={BedDouble} tone="neutral" />
        <StatTile label="Occupied" value={String(s.occupied)} tone="info" />
        <StatTile label="Available" value={String(s.available)} tone="success" />
        <StatTile label="Occupancy" value={`${s.occupancyPercent}%`} tone="info" />
        <StatTile label="Present" value={String(s.presentTonight)} tone="success" />
        <StatTile label="On leave" value={String(s.onLeave)} icon={CalendarDays} tone="info" />
        <StatTile label="Vacant rooms" value={String(s.vacantRooms)} tone="neutral" />
        <StatTile label="Complaints" value={String(s.openComplaints)} icon={MessageSquareWarning} tone={s.openComplaints > 0 ? "warning" : "success"} />
        <StatTile label="Maintenance" value={String(s.maintenanceRequests)} icon={Wrench} tone={s.maintenanceRequests > 0 ? "warning" : "success"} />
        <StatTile label="Visitors today" value={String(s.visitorsToday)} icon={UsersRound} tone="neutral" />
      </section>

      <div className="grid grid-cols-1 gap-md lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-md">
          <div className="mb-sm flex items-center justify-between"><h2 className="text-sm font-semibold text-foreground">Leave to review</h2><Link href="/hostel/leave" className="text-xs text-primary">All →</Link></div>
          {leaveToReview.length === 0 ? <p className="py-md text-center text-sm text-muted-foreground">No leave awaiting review.</p> : (
            <div className="flex flex-col gap-xs">
              {leaveToReview.map((l) => (
                <Link key={l.id} href="/hostel/leave" className="flex items-center justify-between gap-sm rounded-md border border-border p-sm hover:border-primary/40">
                  <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{studentName(l.studentId)}</p><p className="text-xs text-muted-foreground">{formatDate(l.fromDate)} → {formatDate(l.toDate)} · {l.destination}</p></div>
                  <Badge tone={hostelLeaveStatusTone[l.status]}>{hostelLeaveStatusLabels[l.status]}</Badge>
                </Link>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-lg border border-border bg-surface p-md">
          <div className="mb-sm flex items-center justify-between"><h2 className="text-sm font-semibold text-foreground">Open complaints</h2><Link href="/hostel/complaints" className="text-xs text-primary">All →</Link></div>
          {recentComplaints.length === 0 ? <p className="py-md text-center text-sm text-muted-foreground">No open complaints.</p> : (
            <div className="flex flex-col gap-xs">
              {recentComplaints.map((c) => (
                <Link key={c.id} href="/hostel/complaints" className="flex items-center justify-between gap-sm rounded-md border border-border p-sm hover:border-primary/40">
                  <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{complaintCategoryLabels[c.category]} · {studentName(c.studentId)}</p><p className="truncate text-xs text-muted-foreground">{c.description}</p></div>
                  <Badge tone={complaintStatusTone[c.status]}>{c.status}</Badge>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
