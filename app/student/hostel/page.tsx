"use client";

import Link from "next/link";
import { BedDouble, CalendarDays } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { hostelLeaveStatusLabels, hostelLeaveStatusTone, hostelLeaveTypeLabels } from "@/lib/types/hostel";
import { formatDate } from "@/lib/utils";

export default function StudentHostelPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  if (!can("hostel.viewOwn") && !can("hostel.view")) return <PermissionDenied action="view your hostel" role={roleLabels[role]} backHref="/" />;

  const alloc = db.hostelAllocations.find((a) => a.status === "active");
  const me = alloc ? db.students.find((s) => s.id === alloc.studentId) : db.students[0];
  const myAlloc = me ? db.hostelAllocations.find((a) => a.studentId === me.id && a.status === "active") : undefined;
  const room = myAlloc ? db.hostelRooms.find((r) => r.id === myAlloc.roomId) : undefined;
  const building = myAlloc ? db.hostelBuildings.find((b) => b.id === myAlloc.buildingId) : undefined;
  const bed = myAlloc ? db.hostelBeds.find((b) => b.id === myAlloc.bedId) : undefined;
  const myLeave = me ? db.hostelLeave.filter((l) => l.studentId === me.id) : [];

  if (!myAlloc) return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0"><h1 className="text-lg font-semibold text-foreground">My hostel</h1><div className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">You are a day scholar — no hostel allocation on record.</div></div>
  );

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="text-lg font-semibold text-foreground">My hostel</h1><p className="text-xs text-muted-foreground">{me?.profile.firstName} {me?.profile.lastName}</p></div>
      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Building" value={building?.name ?? "—"} icon={BedDouble} tone="neutral" />
        <StatTile label="Room" value={room?.roomNumber ?? "—"} tone="info" />
        <StatTile label="Bed" value={bed?.position ?? "—"} tone="neutral" />
        <StatTile label="Warden" value={building?.wardenName ?? "—"} tone="neutral" />
      </div>
      <div className="rounded-lg border border-border bg-surface p-md">
        <div className="mb-sm flex items-center justify-between"><h2 className="flex items-center gap-1 text-sm font-semibold text-foreground"><CalendarDays className="size-4" /> My leave</h2></div>
        {myLeave.length === 0 ? <p className="py-md text-center text-sm text-muted-foreground">No leave requests.</p> : (
          <div className="flex flex-col gap-xs">{myLeave.map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm text-sm"><span className="min-w-0 truncate text-foreground">{hostelLeaveTypeLabels[l.type]} · {formatDate(l.fromDate)}→{formatDate(l.toDate)}</span><Badge tone={hostelLeaveStatusTone[l.status]}>{hostelLeaveStatusLabels[l.status]}</Badge></div>
          ))}</div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">Need help? Raise a request with your warden or via <Link href="/helpdesk" className="text-primary">Helpdesk</Link>.</p>
    </div>
  );
}
