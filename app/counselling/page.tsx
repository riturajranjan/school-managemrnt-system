"use client";

import Link from "next/link";
import { BookOpen, CalendarClock, Gauge, HandHeart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";

export default function CounsellingHubPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  if (!can("counselling.view")) return <PermissionDenied action="view counselling" role={roleLabels[role]} backHref="/campus-life" />;

  const today = new Date().toISOString().slice(0, 10);
  const todayCount = db.counsellingAppointments.filter((a) => a.date === today).length;
  const upcoming = db.counsellingAppointments.filter((a) => a.date >= today && (a.status === "scheduled" || a.status === "requested")).length;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-lg font-semibold text-foreground">Counselling</h1><p className="text-xs text-muted-foreground">Administrative scheduling only — private content stays with counsellors</p></div>
        <Button asChild size="sm"><Link href="/counselling/dashboard"><Gauge className="size-3.5" /> Dashboard</Link></Button>
      </div>
      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Today" value={String(todayCount)} icon={CalendarClock} tone="neutral" />
        <StatTile label="Upcoming" value={String(upcoming)} tone="info" />
        <StatTile label="Resources" value={String(db.counsellingResources.length)} icon={BookOpen} tone="neutral" />
        <StatTile label="Counsellors" value={String(new Set(db.counsellingAppointments.map((a) => a.counsellorName)).size)} tone="neutral" />
      </div>
      <div className="grid grid-cols-1 gap-sm sm:grid-cols-3">
        <Link href="/counselling/appointments" className="surface-3d flex items-center gap-sm rounded-lg border border-border bg-surface p-md hover:border-primary/40"><span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary"><CalendarClock className="size-4" /></span><div><p className="text-sm font-semibold text-foreground">Appointments</p><p className="text-xs text-muted-foreground">Schedule and status</p></div></Link>
        <Link href="/counselling/resources" className="surface-3d flex items-center gap-sm rounded-lg border border-border bg-surface p-md hover:border-primary/40"><span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary"><BookOpen className="size-4" /></span><div><p className="text-sm font-semibold text-foreground">Resources</p><p className="text-xs text-muted-foreground">Student wellbeing library</p></div></Link>
        <Link href="/counselling/dashboard" className="surface-3d flex items-center gap-sm rounded-lg border border-border bg-surface p-md hover:border-primary/40"><span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary"><HandHeart className="size-4" /></span><div><p className="text-sm font-semibold text-foreground">Command Centre</p><p className="text-xs text-muted-foreground">Overview</p></div></Link>
      </div>
    </div>
  );
}
