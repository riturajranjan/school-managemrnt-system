"use client";

// Phase 9I: the Visitor-specific tiles + "currently inside" list are now
// real (GET /api/visitors/dashboard). Gate passes/deliveries/call
// follow-ups/incidents stay on the mock store — separate Front Desk sub-
// domains out of this phase's scope. The old mock's "Waiting" tile is
// dropped (no WAITING status in the real visit lifecycle — see the schema's
// Phase 9I doc comment).
import Link from "next/link";
import { AlertTriangle, CalendarClock, DoorOpen, Package, Phone, ScanLine, ShieldCheck, UserPlus, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { useVisitorDashboard } from "@/lib/hooks/api/use-visitors-api";
import { roleLabels } from "@/lib/permissions/roles";

export default function FrontDeskCommandCentre() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const { data: visitorDashboard } = useVisitorDashboard();
  if (!can("frontdesk.view")) return <PermissionDenied action="view the front desk" role={roleLabels[role]} backHref="/" />;

  const activePasses = db.gatePasses.filter((g) => g.status === "active" || g.status === "approved").length;
  const pendingDeliveries = db.deliveries.filter((d) => d.status === "awaiting-collection" || d.status === "received").length;
  const followUps = db.receptionCalls.filter((c) => c.followUpNeeded).length;
  const openIncidents = db.frontDeskIncidents.filter((i) => i.status === "open").length;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Front Desk</h1>
          <p className="text-xs text-muted-foreground">Visitors, appointments, gate passes, calls & deliveries</p>
        </div>
        {can("visitors.manage") && <Button asChild size="sm"><Link href="/front-desk/visitors/new"><ScanLine className="size-3.5" /> Check in visitor</Link></Button>}
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4 lg:grid-cols-4">
        <StatTile label="Visitors today" value={String(visitorDashboard?.today ?? "—")} icon={Users} tone="neutral" />
        <StatTile label="Currently inside" value={String(visitorDashboard?.currentlyInside ?? "—")} icon={DoorOpen} tone={(visitorDashboard?.currentlyInside ?? 0) > 0 ? "info" : "neutral"} />
        <StatTile label="Expected today" value={String(visitorDashboard?.expectedToday ?? "—")} icon={UserPlus} tone="neutral" />
        <StatTile label="Checked out today" value={String(visitorDashboard?.checkedOutToday ?? "—")} icon={CalendarClock} tone="neutral" />
        <StatTile label="Active gate passes" value={String(activePasses)} icon={ShieldCheck} tone="info" />
        <StatTile label="Deliveries" value={String(pendingDeliveries)} icon={Package} tone={pendingDeliveries > 0 ? "warning" : "success"} />
        <StatTile label="Call follow-ups" value={String(followUps)} icon={Phone} tone={followUps > 0 ? "warning" : "success"} />
      </div>

      {openIncidents > 0 && (
        <Link href="/front-desk/incidents" className="flex items-center justify-between rounded-md border border-warning/30 bg-warning/8 p-sm text-sm text-warning">
          <span>{openIncidents} open front-desk incident(s)</span>
          <span className="underline">Review</span>
        </Link>
      )}

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
