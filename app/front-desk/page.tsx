"use client";

// Phase 9I: the Visitor-specific tiles + "currently inside" list are real
// (GET /api/visitors/dashboard). Gate passes/deliveries/call follow-ups/
// incidents are separate Front Desk sub-domains with no real backing yet
// (still on the mock store — see their own pages) and are deliberately NOT
// surfaced as stat tiles/banners here, since this hub's numbers must only
// ever reflect real data. The old mock's "Waiting" tile is dropped (no
// WAITING status in the real visit lifecycle — see the schema's Phase 9I
// doc comment).
import Link from "next/link";
import { AlertTriangle, CalendarClock, DoorOpen, Package, Phone, ScanLine, ShieldCheck, UserPlus, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useVisitorDashboard } from "@/lib/hooks/api/use-visitors-api";
import { roleLabels } from "@/lib/permissions/roles";

export default function FrontDeskCommandCentre() {
  const { can, role } = usePermissions();
  const { data: visitorDashboard } = useVisitorDashboard();
  if (!can("frontdesk.view")) return <PermissionDenied action="view the front desk" role={roleLabels[role]} backHref="/" />;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Front Desk</h1>
          <p className="text-xs text-muted-foreground">Visitors, appointments, gate passes, calls & deliveries</p>
        </div>
        {can("visitors.manage") && <Button asChild size="sm"><Link href="/front-desk/visitors/new"><ScanLine className="size-3.5" /> Check in visitor</Link></Button>}
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Visitors today" value={String(visitorDashboard?.today ?? "—")} icon={Users} tone="neutral" />
        <StatTile label="Currently inside" value={String(visitorDashboard?.currentlyInside ?? "—")} icon={DoorOpen} tone={(visitorDashboard?.currentlyInside ?? 0) > 0 ? "info" : "neutral"} />
        <StatTile label="Expected today" value={String(visitorDashboard?.expectedToday ?? "—")} icon={UserPlus} tone="neutral" />
        <StatTile label="Checked out today" value={String(visitorDashboard?.checkedOutToday ?? "—")} icon={CalendarClock} tone="neutral" />
      </div>

      <div className="rounded-lg border border-border bg-surface p-md">
        <div className="mb-sm flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Currently inside campus</h2>
          <Link href="/front-desk/visitors" className="text-xs text-primary">All visitors →</Link>
        </div>
        {!visitorDashboard || visitorDashboard.currentlyInsideList.length === 0 ? (
          <p className="py-md text-center text-sm text-muted-foreground">No visitors inside right now.</p>
        ) : (
          <div className="flex flex-col gap-xs">
            {visitorDashboard.currentlyInsideList.map((v) => (
              <div key={v.id} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{v.visitorName}</p>
                  <p className="truncate text-xs text-muted-foreground">Meeting {v.hostName}{v.department ? ` · ${v.department}` : ""}{v.checkedInAt ? ` · in ${new Date(v.checkedInAt).toTimeString().slice(0, 5)}` : ""}</p>
                </div>
                <Badge tone="success">Checked in</Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-3 lg:grid-cols-6">
        {[
          { href: "/front-desk/visitors", label: "Visitors", icon: Users },
          { href: "/front-desk/appointments", label: "Appointments", icon: CalendarClock },
          { href: "/front-desk/gate-passes", label: "Gate passes", icon: ShieldCheck },
          { href: "/front-desk/calls", label: "Call log", icon: Phone },
          { href: "/front-desk/deliveries", label: "Deliveries", icon: Package },
          { href: "/front-desk/incidents", label: "Incidents", icon: AlertTriangle },
        ].map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className="surface-3d flex flex-col items-center gap-1 rounded-lg border border-border bg-surface p-sm text-center hover:-translate-y-0.5">
            <span className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary"><Icon className="size-4" /></span>
            <span className="text-xs font-medium text-foreground">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
