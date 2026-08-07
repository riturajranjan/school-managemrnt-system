"use client";

import Link from "next/link";
import { AlertTriangle, CalendarClock, DoorOpen, Package, Phone, ScanLine, ShieldCheck, UserPlus, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { visitorStatusLabels, visitorStatusTone } from "@/lib/types/communication";

export default function FrontDeskCommandCentre() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  if (!can("frontdesk.view")) return <PermissionDenied action="view the front desk" role={roleLabels[role]} backHref="/" />;

  const today = new Date().toISOString().slice(0, 10);
  const todayVisitors = db.visitors.filter((v) => v.date === today);
  const inside = todayVisitors.filter((v) => v.status === "checked-in" || v.status === "meeting").length;
  const expected = todayVisitors.filter((v) => v.status === "expected").length;
  const waiting = todayVisitors.filter((v) => v.status === "waiting").length;
  const appointmentsToday = db.visitorAppointments.filter((a) => a.date === today).length;
  const activePasses = db.gatePasses.filter((g) => g.status === "active" || g.status === "approved").length;
  const pendingDeliveries = db.deliveries.filter((d) => d.status === "awaiting-collection" || d.status === "received").length;
  const followUps = db.receptionCalls.filter((c) => c.followUpNeeded).length;
  const openIncidents = db.frontDeskIncidents.filter((i) => i.status === "open").length;

  const currentlyInside = todayVisitors.filter((v) => v.status === "checked-in" || v.status === "meeting");

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Front Desk</h1>
          <p className="text-xs text-muted-foreground">Visitors, appointments, gate passes, calls & deliveries</p>
        </div>
        {can("frontdesk.manage") && <Button asChild size="sm"><Link href="/front-desk/visitors/new"><ScanLine className="size-3.5" /> Check in visitor</Link></Button>}
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4 lg:grid-cols-4">
        <StatTile label="Visitors today" value={String(todayVisitors.length)} icon={Users} tone="neutral" />
        <StatTile label="Currently inside" value={String(inside)} icon={DoorOpen} tone={inside > 0 ? "info" : "neutral"} />
        <StatTile label="Expected" value={String(expected)} icon={UserPlus} tone="neutral" />
        <StatTile label="Waiting" value={String(waiting)} icon={AlertTriangle} tone={waiting > 0 ? "warning" : "success"} />
        <StatTile label="Appointments" value={String(appointmentsToday)} icon={CalendarClock} tone="neutral" />
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
        {currentlyInside.length === 0 ? (
          <p className="py-md text-center text-sm text-muted-foreground">No visitors inside right now.</p>
        ) : (
          <div className="flex flex-col gap-xs">
            {currentlyInside.map((v) => (
              <div key={v.id} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{v.name}</p>
                  <p className="truncate text-xs text-muted-foreground">Meeting {v.hostName} · {v.department} · in {v.arrivalTime}</p>
                </div>
                <Badge tone={visitorStatusTone[v.status]}>{visitorStatusLabels[v.status]}</Badge>
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
