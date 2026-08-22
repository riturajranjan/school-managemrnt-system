"use client";

// Hostel hub (Phase 9Q) — headline stats are real (PostgreSQL/API); the
// quickLinks below still legitimately point at Leave/Visitors/Complaints/
// Maintenance/Mess/Reports/Settings, which stay fully mock — no real parent-
// approval workflow, extended Visitor identity, shared ticketing
// infrastructure, or billing policy exists for any of them (mess is
// deliberately deferred to a future Cafeteria phase, never built here).
// Matches the Inventory/Assets/HR-Core hub precedent: a hybrid hub is not
// itself in the migrated-route mock guard.
import Link from "next/link";
import { BedDouble, Building2, CalendarCheck, CalendarDays, ClipboardList, Gauge, MessageSquareWarning, Settings, SquareStack, UsersRound, Utensils, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useHostelDashboard } from "@/lib/hooks/api/use-hostel-api";
import { roleLabels } from "@/lib/permissions/roles";

const links = [
  { href: "/hostel/buildings", label: "Hostels", description: "Wardens and occupancy", icon: Building2 },
  { href: "/hostel/rooms", label: "Rooms", description: "Occupancy map and room detail", icon: SquareStack },
  { href: "/hostel/beds", label: "Beds", description: "Bed register and status", icon: BedDouble },
  { href: "/hostel/residents", label: "Residents", description: "Boarder directory", icon: UsersRound },
  { href: "/hostel/allocations", label: "Allocation", description: "Assign a student to a bed", icon: BedDouble },
  { href: "/hostel/attendance", label: "Attendance", description: "Nightly hostel roll call", icon: CalendarCheck },
  { href: "/hostel/leave", label: "Leave", description: "Home visits and approvals", icon: CalendarDays },
  { href: "/hostel/visitors", label: "Visitors", description: "Hostel visitor requests", icon: UsersRound },
  { href: "/hostel/complaints", label: "Complaints", description: "Resident complaints", icon: MessageSquareWarning },
  { href: "/hostel/maintenance", label: "Maintenance", description: "Room maintenance board", icon: Wrench },
  { href: "/hostel/mess", label: "Mess", description: "Daily mess menu", icon: Utensils },
  { href: "/hostel/reports", label: "Reports", description: "Occupancy and activity", icon: ClipboardList },
  { href: "/hostel/settings", label: "Settings", description: "Hostel configuration", icon: Settings },
];

export default function HostelHubPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: s } = useHostelDashboard();
  if (!capabilitiesLoading && !hasServerPermission("hostel.view")) return <PermissionDenied action="view the hostel" role={roleLabels[role]} backHref="/campus-life" />;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Hostel</h1>
          <p className="text-xs text-muted-foreground">Residential operations and occupancy</p>
        </div>
        <Button asChild size="sm"><Link href="/hostel/dashboard"><Gauge className="size-3.5" /> Command Centre</Link></Button>
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Residents" value={String(s?.activeResidents ?? 0)} icon={BedDouble} tone="neutral" />
        <StatTile label="Occupancy" value={`${s?.occupancyPct ?? 0}%`} tone="info" />
        <StatTile label="Available beds" value={String(s?.availableBeds ?? 0)} tone="success" />
        <StatTile label="Maintenance" value={String(s?.roomsInMaintenance ?? 0)} icon={Wrench} tone={(s?.roomsInMaintenance ?? 0) > 0 ? "warning" : "success"} />
      </div>

      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2 lg:grid-cols-3">
        {links.map(({ href, label, description, icon: Icon }) => (
          <Link key={href} href={href} className="surface-3d flex items-center gap-sm rounded-lg border border-border bg-surface p-md outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:-translate-y-0.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><Icon className="size-4" /></span>
            <div className="min-w-0"><p className="text-sm font-semibold text-foreground">{label}</p><p className="truncate text-xs text-muted-foreground">{description}</p></div>
          </Link>
        ))}
      </div>
    </div>
  );
}
