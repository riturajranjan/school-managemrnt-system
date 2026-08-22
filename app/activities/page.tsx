"use client";

// Activities Command Centre (Phase 9U) — real PostgreSQL/API cutover for
// stat tiles and upcoming events. House standings and the "Campus Activity
// Pulse" gauge are DROPPED, not deferred-and-kept — Houses/points are a
// whole separate competitive system this phase does not build (see
// route-mock-guard.test.ts), and the Pulse gauge was exactly the kind of
// fabricated composite engagement score real dashboards must never show.
import Link from "next/link";
import { CalendarClock, Medal, PartyPopper, Shield, Sparkles, Users2, Volleyball } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useActivityDashboard, useActivityEvents } from "@/lib/hooks/api/use-activities-api";
import { roleLabels } from "@/lib/permissions/roles";
import { formatDate } from "@/lib/utils";

export default function ActivitiesCommandCentre() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: dashboard } = useActivityDashboard();
  const { data: upcoming } = useActivityEvents({ upcoming: true });

  if (!capabilitiesLoading && !hasServerPermission("activities.view")) return <PermissionDenied action="view activities" role={roleLabels[role]} backHref="/" />;
  const s = dashboard ?? { activeActivities: 0, activeMemberships: 0, upcomingEvents: 0, eventsThisMonth: 0, coordinatorCount: 0, participationCount: 0 };

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><Sparkles className="size-5 text-primary" /> Activities Command Centre</h1>
          <p className="text-xs text-muted-foreground">Clubs · Coordinators · Memberships · Events</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Active activities" value={String(s.activeActivities)} icon={Users2} tone="neutral" />
        <StatTile label="Memberships" value={String(s.activeMemberships)} tone="info" />
        <StatTile label="Upcoming events" value={String(s.upcomingEvents)} icon={PartyPopper} tone="info" />
        <StatTile label="Events this month" value={String(s.eventsThisMonth)} icon={CalendarClock} tone="neutral" />
        <StatTile label="Coordinators" value={String(s.coordinatorCount)} tone="neutral" />
        <StatTile label="Participation" value={String(s.participationCount)} icon={Medal} tone="success" />
      </div>

      <section className="rounded-lg border border-border bg-surface p-md">
        <div className="mb-sm flex items-center justify-between"><h2 className="text-sm font-semibold text-foreground">Upcoming events</h2><Link href="/activities/events/calendar" className="text-xs text-primary">Calendar →</Link></div>
        <div className="flex flex-col gap-xs">
          {upcoming.slice(0, 5).map((e) => (
            <Link key={e.id} href={`/activities/events/${e.id}`} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm text-sm transition hover:border-primary/40 hover:bg-surface-secondary/40">
              <span className="min-w-0"><span className="block truncate font-medium text-foreground">{e.title}</span><span className="block truncate text-xs text-muted-foreground">{e.activityName} · {formatDate(e.startAt)}{e.location ? ` · ${e.location}` : ""}</span></span>
              <Badge tone="info">{e.status}</Badge>
            </Link>
          ))}
          {upcoming.length === 0 && <p className="py-md text-center text-sm text-muted-foreground">No upcoming events.</p>}
        </div>
      </section>

      <div className="grid grid-cols-2 gap-xs sm:grid-cols-4">
        <Link href="/activities/clubs" className="surface-3d flex items-center justify-center gap-xs rounded-lg border border-border bg-surface p-md text-sm font-medium text-foreground hover:border-primary/40"><Users2 className="size-3.5" /> Clubs</Link>
        <Link href="/activities/sports" className="surface-3d flex items-center justify-center gap-xs rounded-lg border border-border bg-surface p-md text-sm font-medium text-foreground hover:border-primary/40"><Volleyball className="size-3.5" /> Sports</Link>
        <Link href="/activities/competitions" className="surface-3d flex items-center justify-center gap-xs rounded-lg border border-border bg-surface p-md text-sm font-medium text-foreground hover:border-primary/40"><Medal className="size-3.5" /> Competitions</Link>
        <Link href="/activities/houses" className="surface-3d flex items-center justify-center gap-xs rounded-lg border border-border bg-surface p-md text-sm font-medium text-foreground hover:border-primary/40"><Shield className="size-3.5" /> Houses</Link>
      </div>
    </div>
  );
}
