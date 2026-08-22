"use client";

// Hostel Command Centre (Phase 9Q) — real PostgreSQL/API cutover. DB-derived
// metrics only. Dropped (no real backing): fee collection, meal satisfaction,
// parent approval, security score, complaint SLA. Leave/Complaints panels
// dropped — those domains are deferred, not honestly summarizable yet.
import Link from "next/link";
import { BedDouble, CalendarDays, ClipboardList, UserPlus, UsersRound, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { useShell } from "@/components/shell/shell-context";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useHostelDashboard } from "@/lib/hooks/api/use-hostel-api";
import { roleLabels } from "@/lib/permissions/roles";
import { formatDate } from "@/lib/utils";

export default function HostelDashboardPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { activeSession } = useShell();
  const { data: s } = useHostelDashboard();
  if (!capabilitiesLoading && !hasServerPermission("hostel.view")) return <PermissionDenied action="view the hostel command centre" role={roleLabels[role]} backHref="/hostel" />;

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Hostel Command Centre</h1>
          <p className="text-xs text-muted-foreground">{activeSession} · {formatDate(today)}</p>
        </div>
        {hasServerPermission("hostel.manage") && (
          <div className="flex flex-wrap gap-xs">
            <Button asChild size="sm"><Link href="/hostel/allocations"><UserPlus className="size-3.5" /> Allocate bed</Link></Button>
            <Button asChild size="sm" variant="outline"><Link href="/hostel/attendance"><ClipboardList className="size-3.5" /> Attendance</Link></Button>
          </div>
        )}
      </div>

      <section className="grid grid-cols-2 gap-sm sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Total beds" value={String(s?.activeBeds ?? 0)} icon={BedDouble} tone="neutral" />
        <StatTile label="Occupied" value={String(s?.occupiedBeds ?? 0)} tone="info" />
        <StatTile label="Available" value={String(s?.availableBeds ?? 0)} tone="success" />
        <StatTile label="Occupancy" value={`${s?.occupancyPct ?? 0}%`} tone="info" />
        <StatTile label="Present tonight" value={String(s?.presentTonight ?? 0)} tone="success" />
        <StatTile label="On leave tonight" value={String(s?.onLeaveTonight ?? 0)} icon={CalendarDays} tone="info" />
        <StatTile label="Not marked" value={String(s?.notMarkedTonight ?? 0)} tone={(s?.notMarkedTonight ?? 0) > 0 ? "warning" : "success"} />
        <StatTile label="Rooms in maintenance" value={String(s?.roomsInMaintenance ?? 0)} icon={Wrench} tone={(s?.roomsInMaintenance ?? 0) > 0 ? "warning" : "success"} />
        <StatTile label="Total residents" value={String(s?.activeResidents ?? 0)} icon={UsersRound} tone="neutral" />
        <StatTile label="Hostels" value={String(s?.totalHostels ?? 0)} tone="neutral" />
      </section>

      <div className="rounded-lg border border-dashed border-border bg-surface p-sm text-xs text-muted-foreground">
        Leave, visitors, complaints, maintenance tickets and mess are not tracked in this system yet — see the <Link href="/hostel" className="text-primary underline underline-offset-2">Hostel hub</Link> for those (still mock) sections.
      </div>
    </div>
  );
}
