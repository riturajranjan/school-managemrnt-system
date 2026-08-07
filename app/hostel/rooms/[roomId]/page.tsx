"use client";

import Link from "next/link";
import { use, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BedLayout } from "@/components/campus/bed-layout";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { endAllocation, setBedStatus } from "@/lib/services/campus-service";
import { roleLabels } from "@/lib/permissions/roles";
import { complaintCategoryLabels, complaintStatusTone, maintenanceStatusLabels, maintenanceStatusTone, roomStatusLabels, roomStatusTone, roomTypeLabels } from "@/lib/types/hostel";

export default function RoomWorkspacePage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params);
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [, force] = useState(0);

  const room = db.hostelRooms.find((r) => r.id === roomId);
  if (!can("hostel.view")) return <PermissionDenied action="view rooms" role={roleLabels[role]} backHref="/hostel/rooms" />;
  if (!room) return <div className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Room not found. <Link href="/hostel/rooms" className="text-primary">Back</Link></div>;

  const canManage = can("hostel.manage") || can("hostel.allocate");
  const building = db.hostelBuildings.find((b) => b.id === room.buildingId);
  const floor = db.hostelFloors.find((f) => f.id === room.floorId);
  const beds = db.hostelBeds.filter((b) => b.roomId === room.id);
  const complaints = db.hostelComplaints.filter((c) => c.roomId === room.id);
  const maintenance = db.hostelMaintenance.filter((m) => m.roomId === room.id);
  const studentName = (id?: string) => { const s = db.students.find((x) => x.id === id); return s ? `${s.profile.firstName} ${s.profile.lastName}` : "—"; };

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-sm">
        <Button asChild size="icon" variant="ghost" aria-label="Back"><Link href="/hostel/rooms"><ArrowLeft className="size-4" /></Link></Button>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold text-foreground">Room {room.roomNumber}</h1>
          <p className="truncate text-xs text-muted-foreground">{building?.name} · {floor?.name} · {roomTypeLabels[room.type]}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-xs">
        <Badge tone={roomStatusTone[room.status]}>{roomStatusLabels[room.status]}</Badge>
        <Badge tone="neutral">{beds.filter((b) => b.status === "occupied").length}/{room.capacity} occupied</Badge>
        {room.facilities.map((f) => <span key={f} className="rounded-pill bg-surface-secondary px-2 py-0.5 text-xs text-muted-foreground">{f}</span>)}
      </div>

      <div className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">Beds & residents</h2>
        <BedLayout beds={beds} studentName={studentName} />
        {canManage && (
          <div className="mt-md flex flex-col gap-xs">
            {beds.map((bed) => {
              const alloc = db.hostelAllocations.find((a) => a.bedId === bed.id && a.status === "active");
              return (
                <div key={bed.id} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm text-sm">
                  <span className="text-foreground">Bed {bed.position} · {bed.status === "occupied" ? studentName(bed.studentId) : bed.status}</span>
                  <div className="flex gap-xs">
                    {bed.status === "occupied" && alloc && <Button size="sm" variant="ghost" onClick={() => { endAllocation(alloc.id); force((n) => n + 1); }}>End allocation</Button>}
                    {bed.status === "available" && <Button size="sm" variant="ghost" onClick={() => { setBedStatus(bed.id, "blocked"); force((n) => n + 1); }}>Block</Button>}
                    {(bed.status === "blocked" || bed.status === "maintenance") && <Button size="sm" variant="ghost" onClick={() => { setBedStatus(bed.id, "available"); force((n) => n + 1); }}>Unblock</Button>}
                  </div>
                </div>
              );
            })}
            <Button asChild size="sm" variant="outline" className="mt-1 w-fit"><Link href="/hostel/allocations">Allocate a student</Link></Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm text-sm font-semibold text-foreground">Complaints ({complaints.length})</h2>
          {complaints.length === 0 ? <p className="text-xs text-muted-foreground">None.</p> : complaints.map((c) => (
            <div key={c.id} className="mb-1 flex items-center justify-between gap-sm text-sm"><span className="truncate text-foreground">{complaintCategoryLabels[c.category]}</span><Badge tone={complaintStatusTone[c.status]}>{c.status}</Badge></div>
          ))}
        </div>
        <div className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm text-sm font-semibold text-foreground">Maintenance ({maintenance.length})</h2>
          {maintenance.length === 0 ? <p className="text-xs text-muted-foreground">None.</p> : maintenance.map((m) => (
            <div key={m.id} className="mb-1 flex items-center justify-between gap-sm text-sm"><span className="truncate text-foreground">{m.issue}</span><Badge tone={maintenanceStatusTone[m.status]}>{maintenanceStatusLabels[m.status]}</Badge></div>
          ))}
        </div>
      </div>
    </div>
  );
}
