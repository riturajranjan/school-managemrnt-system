"use client";

// Hostel occupancy map (Phase 9Q) — real PostgreSQL/API cutover. Floors are a
// plain display-grouping derived from HostelRoom.floorNumber (no separate
// Floor entity — see the schema's doc comment). OccupancyMap/BedLayout are
// reused unchanged; real data is adapted to their existing (structural)
// prop shapes so neither component needs to change.
import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OccupancyMap } from "@/components/campus/occupancy-map";
import { BedLayout } from "@/components/campus/bed-layout";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useHostelBeds, useHostelRooms, useHostels } from "@/lib/hooks/api/use-hostel-api";
import { roleLabels } from "@/lib/permissions/roles";
import type { HostelRoomDto } from "@/lib/api/contracts";
import type { HostelBed, HostelRoom, RoomStatus } from "@/lib/types/hostel";

function toMockRoomStatus(r: HostelRoomDto): RoomStatus {
  if (r.status === "maintenance") return "maintenance";
  if (r.status === "archived") return "closed";
  if (r.activeBeds === 0) return "closed";
  if (r.occupiedBeds === 0) return "available";
  if (r.occupiedBeds >= r.activeBeds) return "full";
  return "partial";
}

export default function HostelRoomsPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const hostelIdFromUrl = useSearchParams().get("hostelId") ?? undefined;
  const { data: hostels } = useHostels();
  const [hostelId, setHostelId] = useState(hostelIdFromUrl ?? hostels[0]?.id ?? "");
  const { data: rooms } = useHostelRooms({ hostelId: hostelId || undefined });
  const [selected, setSelected] = useState<HostelRoomDto | null>(null);
  const { data: beds } = useHostelBeds({ roomId: selected?.id });

  const effectiveHostelId = hostelId || hostelIdFromUrl || hostels[0]?.id || "";

  const floors = useMemo(() => {
    const nums = [...new Set(rooms.map((r) => r.floorNumber ?? 0))].sort((a, b) => a - b);
    return nums.map((n) => ({ id: String(n), name: n === 0 ? "Unassigned floor" : `Floor ${n}` }));
  }, [rooms]);

  if (!capabilitiesLoading && !hasServerPermission("hostel.view")) return <PermissionDenied action="view hostel rooms" role={roleLabels[role]} backHref="/hostel" />;

  const mockRooms: HostelRoom[] = rooms.map((r) => ({
    id: r.id, buildingId: r.hostelId, floorId: String(r.floorNumber ?? 0), roomNumber: r.roomNumber,
    type: "custom", capacity: r.totalBeds, facilities: r.facilities, status: toMockRoomStatus(r),
  }));
  const occupiedByRoom = (roomId: string) => rooms.find((r) => r.id === roomId)?.occupiedBeds ?? 0;

  const mockBeds: HostelBed[] = beds.map((b) => ({
    id: b.id, roomId: b.roomId, position: b.bedNumber, studentId: b.occupantStudentId ?? undefined,
    status: b.status === "maintenance" ? "maintenance" : b.status === "archived" ? "blocked" : b.occupied ? "occupied" : "available",
  }));
  const studentName = (id?: string) => beds.find((b) => b.occupantStudentId === id)?.occupantName ?? "—";

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Occupancy map</h1>
          <p className="text-xs text-muted-foreground">Tap a room to see beds and residents</p>
        </div>
        <div className="flex gap-1 overflow-x-auto">
          {hostels.map((h) => (
            <button key={h.id} onClick={() => setHostelId(h.id)} className={`shrink-0 rounded-pill px-3 py-1.5 text-xs font-medium ${effectiveHostelId === h.id ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}>{h.code}</button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-md">
        <OccupancyMap floors={floors} rooms={mockRooms} occupiedByRoom={occupiedByRoom} onRoomClick={(r) => setSelected(rooms.find((x) => x.id === r.id) ?? null)} />
      </div>

      <DetailDrawer open={selected !== null} onOpenChange={(o) => !o && setSelected(null)} title={selected ? `Room ${selected.roomNumber}` : "Room"} description="Room detail">
        {selected && (
          <div className="flex flex-col gap-md">
            <div className="flex items-center justify-between gap-sm">
              <div><p className="text-base font-semibold text-foreground">Room {selected.roomNumber}</p><p className="text-xs text-muted-foreground">{selected.roomType ?? "Room"} · {selected.totalBeds} beds</p></div>
              <Badge tone={selected.status === "active" ? "success" : "warning"}>{selected.status}</Badge>
            </div>
            {selected.facilities.length > 0 && <div className="flex flex-wrap gap-1">{selected.facilities.map((f) => <span key={f} className="rounded-pill bg-surface-secondary px-2 py-0.5 text-xs text-muted-foreground">{f}</span>)}</div>}
            <div><p className="mb-sm text-sm font-semibold text-foreground">Beds</p><BedLayout beds={mockBeds} studentName={studentName} /></div>
            <Button asChild size="sm" variant="outline"><Link href={`/hostel/rooms/${selected.id}`}>Open full room workspace</Link></Button>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
