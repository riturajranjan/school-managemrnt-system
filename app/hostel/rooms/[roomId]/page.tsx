"use client";

// Room workspace (Phase 9Q) — real PostgreSQL/API cutover. Complaints/
// Maintenance panels are dropped (deferred domains — no shared ticket
// infrastructure exists yet); Beds & residents is fully real.
import Link from "next/link";
import { use, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BedLayout } from "@/components/campus/bed-layout";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { setHostelBedStatusRequest, useHostelAssignments, useHostelBeds, useHostelRoom, vacateHostelAssignmentRequest } from "@/lib/hooks/api/use-hostel-api";
import { roleLabels } from "@/lib/permissions/roles";
import type { HostelBed } from "@/lib/types/hostel";

export default function RoomWorkspacePage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params);
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: room, loading, reload: reloadRoom } = useHostelRoom(roomId);
  const { data: beds, reload: reloadBeds } = useHostelBeds({ roomId });
  const { data: assignments, reload: reloadAssignments } = useHostelAssignments({ roomId, status: "active" });
  const [busyId, setBusyId] = useState<string | null>(null);

  if (!capabilitiesLoading && !hasServerPermission("hostel.view")) return <PermissionDenied action="view rooms" role={roleLabels[role]} backHref="/hostel/rooms" />;
  if (!loading && !room) return <div className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Room not found. <Link href="/hostel/rooms" className="text-primary">Back</Link></div>;
  if (!room) return null;

  const canManage = hasServerPermission("hostel.manage");
  const reload = () => { reloadRoom(); reloadBeds(); reloadAssignments(); };

  const mockBeds: HostelBed[] = beds.map((b) => ({
    id: b.id, roomId: b.roomId, position: b.bedNumber, studentId: b.occupantStudentId ?? undefined,
    status: b.status === "maintenance" ? "maintenance" : b.status === "archived" ? "blocked" : b.occupied ? "occupied" : "available",
  }));
  const studentName = (id?: string) => beds.find((b) => b.occupantStudentId === id)?.occupantName ?? "—";

  async function vacateBed(bedId: string) {
    const assignment = assignments.find((a) => a.bedId === bedId);
    if (!assignment) return;
    setBusyId(bedId);
    await vacateHostelAssignmentRequest(assignment.id);
    setBusyId(null);
    reload();
  }
  async function toggleBed(bedId: string, next: "active" | "maintenance") {
    setBusyId(bedId);
    await setHostelBedStatusRequest(bedId, { status: next });
    setBusyId(null);
    reload();
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-sm">
        <Button asChild size="icon" variant="ghost" aria-label="Back"><Link href="/hostel/rooms"><ArrowLeft className="size-4" /></Link></Button>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold text-foreground">Room {room.roomNumber}</h1>
          <p className="truncate text-xs text-muted-foreground">{room.hostelName}{room.floorNumber !== null ? ` · Floor ${room.floorNumber}` : ""} · {room.roomType ?? "Room"}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-xs">
        <Badge tone={room.status === "active" ? "success" : "warning"}>{room.status}</Badge>
        <Badge tone="neutral">{room.occupiedBeds}/{room.totalBeds} occupied</Badge>
        {room.facilities.map((f) => <span key={f} className="rounded-pill bg-surface-secondary px-2 py-0.5 text-xs text-muted-foreground">{f}</span>)}
      </div>

      <div className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">Beds & residents</h2>
        <BedLayout beds={mockBeds} studentName={studentName} />
        {canManage && (
          <div className="mt-md flex flex-col gap-xs">
            {beds.map((bed) => (
              <div key={bed.id} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm text-sm">
                <span className="text-foreground">Bed {bed.bedNumber} · {bed.occupied ? bed.occupantName : bed.status}</span>
                <div className="flex gap-xs">
                  {bed.occupied && <Button size="sm" variant="ghost" disabled={busyId === bed.id} onClick={() => vacateBed(bed.id)}>End allocation</Button>}
                  {!bed.occupied && bed.status === "active" && <Button size="sm" variant="ghost" disabled={busyId === bed.id} onClick={() => toggleBed(bed.id, "maintenance")}>Mark maintenance</Button>}
                  {!bed.occupied && bed.status === "maintenance" && <Button size="sm" variant="ghost" disabled={busyId === bed.id} onClick={() => toggleBed(bed.id, "active")}>Mark active</Button>}
                </div>
              </div>
            ))}
            <Button asChild size="sm" variant="outline" className="mt-1 w-fit"><Link href="/hostel/allocations">Allocate a student</Link></Button>
          </div>
        )}
      </div>
    </div>
  );
}
