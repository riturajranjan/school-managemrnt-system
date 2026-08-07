"use client";

import { Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MiniBar } from "@/components/dashboard/mini-charts";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { hostelSummary } from "@/lib/selectors/campus-brief";
import { roleLabels } from "@/lib/permissions/roles";
import { downloadTextFile } from "@/lib/utils";

export default function HostelReportsPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  if (!can("hostel.view")) return <PermissionDenied action="view hostel reports" role={roleLabels[role]} backHref="/hostel" />;

  const s = hostelSummary(db);
  const byBuilding = db.hostelBuildings.map((b) => {
    const rooms = db.hostelRooms.filter((r) => r.buildingId === b.id);
    const beds = db.hostelBeds.filter((bd) => rooms.some((r) => r.id === bd.roomId));
    const occ = beds.filter((bd) => bd.status === "occupied").length;
    return { name: b.name, occupied: occ, capacity: beds.filter((bd) => bd.status !== "blocked" && bd.status !== "maintenance").length };
  });
  const maxCap = Math.max(1, ...byBuilding.map((b) => b.capacity));

  function exportOccupancy() {
    const lines = ["Building,Occupied,Capacity", ...byBuilding.map((b) => `"${b.name}",${b.occupied},${b.capacity}`)];
    downloadTextFile("hostel-occupancy.csv", lines.join("\n"));
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-lg font-semibold text-foreground">Hostel reports</h1><p className="text-xs text-muted-foreground">Aggregate operations reporting</p></div>
        <Button size="sm" variant="outline" onClick={exportOccupancy}><Download className="size-3.5" /> Export occupancy</Button>
      </div>
      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Residents" value={String(s.residents)} tone="neutral" />
        <StatTile label="Occupancy" value={`${s.occupancyPercent}%`} tone="info" />
        <StatTile label="Vacant rooms" value={String(s.vacantRooms)} tone="success" />
        <StatTile label="Present tonight" value={String(s.presentTonight)} tone="success" />
        <StatTile label="On leave" value={String(s.onLeave)} tone="info" />
        <StatTile label="Complaints" value={String(s.openComplaints)} tone="warning" />
        <StatTile label="Maintenance" value={String(s.maintenanceRequests)} tone="warning" />
        <StatTile label="Visitors today" value={String(s.visitorsToday)} tone="neutral" />
      </div>
      <div className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">Occupancy by building</h2>
        <div className="flex flex-col gap-sm">
          {byBuilding.map((b) => (
            <div key={b.name} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-sm"><span className="text-foreground">{b.name}</span><Badge tone="neutral">{b.occupied}/{b.capacity}</Badge></div>
              <MiniBar percent={(b.occupied / maxCap) * 100} toneClassName="bg-primary" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
