"use client";

import Link from "next/link";
import { BedDouble, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { hostelLeaveStatusLabels, hostelLeaveStatusTone, hostelLeaveTypeLabels, hostelVisitorStatusLabels } from "@/lib/types/hostel";
import { formatDate } from "@/lib/utils";

export default function ParentHostelPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  if (!can("hostel.viewOwn") && !can("hostel.view")) return <PermissionDenied action="view your child's hostel" role={roleLabels[role]} backHref="/" />;

  const alloc = db.hostelAllocations.find((a) => a.status === "active");
  const child = alloc ? db.students.find((s) => s.id === alloc.studentId) : undefined;
  const room = alloc ? db.hostelRooms.find((r) => r.id === alloc.roomId) : undefined;
  const building = alloc ? db.hostelBuildings.find((b) => b.id === alloc.buildingId) : undefined;
  const leave = child ? db.hostelLeave.filter((l) => l.studentId === child.id) : [];
  const visitors = child ? db.hostelVisitors.filter((v) => v.studentId === child.id) : [];

  if (!alloc || !child) return <div className="flex flex-col gap-md pb-20 sm:pb-0"><h1 className="text-lg font-semibold text-foreground">Hostel</h1><div className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No hostel allocation on record for your child.</div></div>;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="text-lg font-semibold text-foreground">Hostel — {child.profile.firstName}</h1><p className="text-xs text-muted-foreground">{child.classId}</p></div>
      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Building" value={building?.name ?? "—"} icon={BedDouble} tone="neutral" />
        <StatTile label="Room" value={room?.roomNumber ?? "—"} tone="info" />
        <StatTile label="Warden" value={building?.wardenName ?? "—"} tone="neutral" />
        <StatTile label="Contact" value="Reception" tone="neutral" />
      </div>
      <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm text-sm font-semibold text-foreground">Leave</h2>
          {leave.length === 0 ? <p className="text-xs text-muted-foreground">No leave records.</p> : <div className="flex flex-col gap-xs">{leave.map((l) => <div key={l.id} className="flex items-center justify-between gap-sm text-sm"><span className="min-w-0 truncate text-foreground">{hostelLeaveTypeLabels[l.type]} · {formatDate(l.fromDate)}</span><Badge tone={hostelLeaveStatusTone[l.status]}>{hostelLeaveStatusLabels[l.status]}</Badge></div>)}</div>}
        </div>
        <div className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm flex items-center gap-1 text-sm font-semibold text-foreground"><UsersRound className="size-4" /> Visitor requests</h2>
          {visitors.length === 0 ? <p className="text-xs text-muted-foreground">No visitor records.</p> : <div className="flex flex-col gap-xs">{visitors.map((v) => <div key={v.id} className="flex items-center justify-between gap-sm text-sm"><span className="min-w-0 truncate text-foreground">{v.visitorName}</span><Badge tone="neutral">{hostelVisitorStatusLabels[v.status]}</Badge></div>)}</div>}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Contact the hostel warden or <Link href="/communication/inbox" className="text-primary">message the school</Link> for changes.</p>
    </div>
  );
}
