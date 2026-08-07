"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { OccupancyMap } from "@/components/campus/occupancy-map";
import { BedLayout } from "@/components/campus/bed-layout";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { roomStatusLabels, roomStatusTone, roomTypeLabels, type HostelRoom } from "@/lib/types/hostel";

export default function HostelRoomsPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [buildingId, setBuildingId] = useState(db.hostelBuildings[0]?.id ?? "");
  const [selected, setSelected] = useState<HostelRoom | null>(null);

  if (!can("hostel.view")) return <PermissionDenied action="view hostel rooms" role={roleLabels[role]} backHref="/hostel" />;

  const floors = db.hostelFloors.filter((f) => f.buildingId === buildingId).sort((a, b) => a.number - b.number);
  const rooms = db.hostelRooms.filter((r) => r.buildingId === buildingId);
  const occupiedByRoom = (roomId: string) => db.hostelBeds.filter((b) => b.roomId === roomId && b.status === "occupied").length;
  const studentName = (id?: string) => { const s = db.students.find((x) => x.id === id); return s ? `${s.profile.firstName} ${s.profile.lastName}` : "—"; };
  const selectedBeds = selected ? db.hostelBeds.filter((b) => b.roomId === selected.id) : [];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Occupancy map</h1>
          <p className="text-xs text-muted-foreground">Tap a room to see beds and residents</p>
        </div>
        <div className="flex gap-1 overflow-x-auto">
          {db.hostelBuildings.map((b) => (
            <button key={b.id} onClick={() => setBuildingId(b.id)} className={`shrink-0 rounded-pill px-3 py-1.5 text-xs font-medium ${buildingId === b.id ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}>{b.code}</button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-md">
        <OccupancyMap floors={floors} rooms={rooms} occupiedByRoom={occupiedByRoom} onRoomClick={setSelected} />
      </div>

      <DetailDrawer open={selected !== null} onOpenChange={(o) => !o && setSelected(null)} title={selected ? `Room ${selected.roomNumber}` : "Room"} description="Room detail">
        {selected && (
          <div className="flex flex-col gap-md">
            <div className="flex items-center justify-between gap-sm">
              <div><p className="text-base font-semibold text-foreground">Room {selected.roomNumber}</p><p className="text-xs text-muted-foreground">{roomTypeLabels[selected.type]} · {selected.capacity} beds</p></div>
              <Badge tone={roomStatusTone[selected.status]}>{roomStatusLabels[selected.status]}</Badge>
            </div>
            {selected.facilities.length > 0 && <div className="flex flex-wrap gap-1">{selected.facilities.map((f) => <span key={f} className="rounded-pill bg-surface-secondary px-2 py-0.5 text-xs text-muted-foreground">{f}</span>)}</div>}
            <div><p className="mb-sm text-sm font-semibold text-foreground">Beds</p><BedLayout beds={selectedBeds} studentName={studentName} /></div>
            <Button asChild size="sm" variant="outline"><Link href={`/hostel/rooms/${selected.id}`}>Open full room workspace</Link></Button>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
