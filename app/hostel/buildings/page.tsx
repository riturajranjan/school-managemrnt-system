"use client";

import Link from "next/link";
import { Building2, UserCog } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { buildingStatusTone, hostelTypeLabels } from "@/lib/types/hostel";

export default function HostelBuildingsPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  if (!can("hostel.view")) return <PermissionDenied action="view hostel buildings" role={roleLabels[role]} backHref="/hostel" />;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Hostel buildings</h1>
        <p className="text-xs text-muted-foreground">{db.hostelBuildings.length} blocks</p>
      </div>

      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2 lg:grid-cols-3">
        {db.hostelBuildings.map((b) => {
          const rooms = db.hostelRooms.filter((r) => r.buildingId === b.id);
          const beds = db.hostelBeds.filter((bd) => rooms.some((r) => r.id === bd.roomId));
          const occupied = beds.filter((bd) => bd.status === "occupied").length;
          const usable = beds.filter((bd) => bd.status !== "blocked" && bd.status !== "maintenance").length;
          const pct = usable > 0 ? Math.round((occupied / usable) * 100) : 0;
          return (
            <Link key={b.id} href={`/hostel/rooms?building=${b.id}`} className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md hover:border-primary/40">
              <div className="flex items-start justify-between gap-sm">
                <div className="flex items-center gap-sm">
                  <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary"><Building2 className="size-4" /></span>
                  <div className="min-w-0"><p className="text-sm font-semibold text-foreground">{b.name}</p><p className="text-xs text-muted-foreground">{b.code} · {hostelTypeLabels[b.type]}</p></div>
                </div>
                <Badge tone={buildingStatusTone[b.status]}>{b.status}</Badge>
              </div>
              <div className="grid grid-cols-3 gap-sm text-center text-xs">
                <div className="rounded-md border border-border p-sm"><p className="text-muted-foreground">Floors</p><p className="text-sm font-semibold text-foreground">{b.floors}</p></div>
                <div className="rounded-md border border-border p-sm"><p className="text-muted-foreground">Rooms</p><p className="text-sm font-semibold text-foreground">{rooms.length}</p></div>
                <div className="rounded-md border border-border p-sm"><p className="text-muted-foreground">Occupancy</p><p className="text-sm font-semibold text-foreground">{pct}%</p></div>
              </div>
              <p className="flex items-center gap-1 text-xs text-muted-foreground"><UserCog className="size-3" /> Warden: {b.wardenName}{b.assistantWardenName ? ` · Asst: ${b.assistantWardenName}` : ""}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
