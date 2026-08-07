"use client";

import Link from "next/link";
import { BedDouble, Building2, CalendarCheck, CalendarDays, ClipboardList, Gauge, MessageSquareWarning, Settings, SquareStack, UsersRound, Utensils, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { hostelSummary } from "@/lib/selectors/campus-brief";
import { roleLabels } from "@/lib/permissions/roles";

const links = [
  { href: "/hostel/buildings", label: "Buildings", description: "Blocks, wardens and occupancy", icon: Building2 },
  { href: "/hostel/rooms", label: "Rooms", description: "Occupancy map and room detail", icon: SquareStack },
  { href: "/hostel/beds", label: "Beds", description: "Bed register and status", icon: BedDouble },
  { href: "/hostel/residents", label: "Residents", description: "Boarder directory", icon: UsersRound },
  { href: "/hostel/allocations", label: "Allocation", description: "Assign a student to a bed", icon: BedDouble },
  { href: "/hostel/attendance", label: "Attendance", description: "Nightly hostel attendance", icon: CalendarCheck },
  { href: "/hostel/leave", label: "Leave", description: "Home visits and approvals", icon: CalendarDays },
  { href: "/hostel/visitors", label: "Visitors", description: "Hostel visitor requests", icon: UsersRound },
  { href: "/hostel/complaints", label: "Complaints", description: "Resident complaints", icon: MessageSquareWarning },
  { href: "/hostel/maintenance", label: "Maintenance", description: "Room maintenance board", icon: Wrench },
  { href: "/hostel/mess", label: "Mess", description: "Daily mess menu", icon: Utensils },
  { href: "/hostel/reports", label: "Reports", description: "Occupancy and activity", icon: ClipboardList },
  { href: "/hostel/settings", label: "Settings", description: "Hostel configuration", icon: Settings },
];

export default function HostelHubPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  if (!can("hostel.view")) return <PermissionDenied action="view the hostel" role={roleLabels[role]} backHref="/campus-life" />;
  const s = hostelSummary(db);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Hostel</h1>
          <p className="text-xs text-muted-foreground">Residential operations, occupancy and welfare</p>
        </div>
        <Button asChild size="sm"><Link href="/hostel/dashboard"><Gauge className="size-3.5" /> Command Centre</Link></Button>
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Residents" value={String(s.residents)} icon={BedDouble} tone="neutral" />
        <StatTile label="Occupancy" value={`${s.occupancyPercent}%`} tone="info" />
        <StatTile label="Available beds" value={String(s.available)} tone="success" />
        <StatTile label="Open complaints" value={String(s.openComplaints)} icon={Wrench} tone={s.openComplaints > 0 ? "warning" : "success"} />
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
