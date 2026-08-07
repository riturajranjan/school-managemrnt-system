"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Award, BarChart3, CalendarClock, Gauge, LayoutList, Medal, PartyPopper, Shield, Sparkles, Trophy, Users2, Volleyball } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { MiniBar } from "@/components/dashboard/mini-charts";
import { PulseGauge } from "@/components/dashboard/pulse-gauge";
import { toneClasses } from "@/components/dashboard/tone";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { activitiesSummary, houseStandings } from "@/lib/selectors/activities-brief";
import { computeActivityPulse } from "@/lib/selectors/activity-pulse";
import { roleLabels } from "@/lib/permissions/roles";
import { eventCategoryLabels, eventStageLabels, eventStageTone } from "@/lib/types/activities";
import { formatDate } from "@/lib/utils";

export default function ActivitiesCommandCentre() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [pulseOpen, setPulseOpen] = useState(false);

  const summary = useMemo(() => activitiesSummary(db), [db]);
  const pulse = useMemo(() => computeActivityPulse(db), [db]);
  const standings = useMemo(() => houseStandings(db), [db]);
  const upcoming = useMemo(() => [...db.schoolEvents].filter((e) => e.stage !== "cancelled" && e.stage !== "archived").sort((a, b) => a.startDate.localeCompare(b.startDate)).slice(0, 5), [db.schoolEvents]);

  if (!can("activities.view")) return <PermissionDenied action="view activities" role={roleLabels[role]} backHref="/" />;

  const sorted = [...pulse.factors].sort((a, b) => a.score - b.score);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><Sparkles className="size-5 text-primary" /> Activities Command Centre</h1>
          <p className="text-xs text-muted-foreground">Events · Clubs · Sports · Competitions · House System</p>
        </div>
        <div className="flex flex-wrap gap-xs">
          {can("activities.manageEvents") && <Button asChild size="sm"><Link href="/activities/events"><PartyPopper className="size-3.5" /> Events</Link></Button>}
          {can("activities.viewAnalytics") && <Button asChild size="sm" variant="outline"><Link href="/activities/analytics"><BarChart3 className="size-3.5" /> Analytics</Link></Button>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-md lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-md">
          <div className="grid grid-cols-2 gap-sm sm:grid-cols-3 lg:grid-cols-4">
            <StatTile label="Events" value={String(summary.totalEvents)} icon={PartyPopper} tone="info" hint={`${summary.upcomingEvents} upcoming`} />
            <StatTile label="Live now" value={String(summary.liveEvents)} tone={summary.liveEvents > 0 ? "success" : "neutral"} />
            <StatTile label="In planning" value={String(summary.eventsInPlanning)} icon={CalendarClock} tone="warning" />
            <StatTile label="Clubs" value={String(summary.totalClubs)} icon={Users2} tone="neutral" hint={`${summary.clubMembers} members`} />
            <StatTile label="Sports teams" value={String(summary.sportsTeams)} icon={Volleyball} tone="info" />
            <StatTile label="Tournaments" value={String(summary.activeTournaments)} icon={Trophy} tone="success" />
            <StatTile label="Competitions" value={String(summary.openCompetitions)} icon={Medal} tone="warning" />
            <StatTile label="Certificates" value={String(summary.certificatesIssued)} icon={Award} tone="neutral" />
          </div>

          <section className="rounded-lg border border-border bg-surface p-md">
            <div className="mb-sm flex items-center justify-between"><h2 className="text-sm font-semibold text-foreground">Upcoming & in-flight events</h2><Link href="/activities/events/calendar" className="text-xs text-primary">Calendar →</Link></div>
            <div className="flex flex-col gap-xs">
              {upcoming.map((e) => (
                <Link key={e.id} href={`/activities/events/${e.id}`} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm text-sm transition hover:border-primary/40 hover:bg-surface-secondary/40">
                  <span className="min-w-0"><span className="block truncate font-medium text-foreground">{e.title}</span><span className="block truncate text-xs text-muted-foreground">{eventCategoryLabels[e.category]} · {formatDate(e.startDate)} · {e.venue}</span></span>
                  <Badge tone={eventStageTone[e.stage]}>{eventStageLabels[e.stage]}</Badge>
                </Link>
              ))}
              {upcoming.length === 0 && <p className="py-md text-center text-sm text-muted-foreground">No events yet.</p>}
            </div>
          </section>

          <section className="rounded-lg border border-border bg-surface p-md">
            <div className="mb-sm flex items-center justify-between"><h2 className="flex items-center gap-1 text-sm font-semibold text-foreground"><Shield className="size-4" /> House standings</h2><Link href="/activities/houses/leaderboard" className="text-xs text-primary">Leaderboard →</Link></div>
            <div className="flex flex-col gap-xs">
              {standings.map((h, i) => (
                <div key={h.id} className="flex items-center gap-sm rounded-md border border-border p-sm">
                  <span className="flex size-7 items-center justify-center rounded-md text-sm font-bold" style={{ backgroundColor: `${h.color}22`, color: h.color }}>{i + 1}</span>
                  <span className="text-base" aria-hidden>{h.emblem}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{h.name}</span>
                  <span className="text-sm font-semibold tabular-nums text-foreground">{h.totalPoints}<span className="ml-1 text-xs font-normal text-muted-foreground">pts</span></span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-md">
          <div className="rounded-lg border border-border bg-surface p-md">
            <div className="mb-sm flex items-center justify-between">
              <h2 className="flex items-center gap-1 text-sm font-semibold text-foreground"><Gauge className="size-4" /> Campus Activity Pulse</h2>
              <button type="button" onClick={() => setPulseOpen(true)} className="flex items-center gap-1 text-xs font-medium text-primary"><LayoutList className="size-3.5" /> Breakdown</button>
            </div>
            <div className="flex flex-col items-center gap-sm">
              <PulseGauge score={pulse.score} factors={pulse.factors} />
              <p className="text-center text-xs text-muted-foreground">Aggregate participation & operations only — never a ranking of any student&apos;s talent or worth.</p>
              <p className="text-center text-xs text-muted-foreground">Strongest: <span className="font-medium text-foreground">{sorted[sorted.length - 1].label}</span> · Watch: <span className="font-medium text-foreground">{sorted[0].label}</span></p>
            </div>
            <div className="mt-md grid grid-cols-2 gap-xs">
              <Button asChild size="sm" variant="outline"><Link href="/activities/clubs"><Users2 className="size-3.5" /> Clubs</Link></Button>
              <Button asChild size="sm" variant="outline"><Link href="/activities/sports"><Volleyball className="size-3.5" /> Sports</Link></Button>
              <Button asChild size="sm" variant="outline"><Link href="/activities/competitions"><Medal className="size-3.5" /> Competitions</Link></Button>
              <Button asChild size="sm" variant="outline"><Link href="/activities/houses"><Shield className="size-3.5" /> Houses</Link></Button>
            </div>
          </div>
        </div>
      </div>

      <DetailDrawer open={pulseOpen} onOpenChange={setPulseOpen} title="Campus Activity Pulse breakdown" description="Operational participation factors (not individual scoring)">
        <div className="flex flex-col gap-md">
          <p className="rounded-md border border-border bg-surface-secondary/40 p-sm text-xs text-muted-foreground">This score reflects how the activities programme is running — participation breadth, event pipeline, planning readiness, turnout, club activity, fixture currency and results throughput. It never scores, ranks or profiles any individual student&apos;s personality, talent or worth.</p>
          {pulse.factors.map((factor) => (
            <div key={factor.key} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-sm"><span className="font-medium text-foreground">{factor.label}</span><span className={toneClasses[factor.tone].text}>{factor.displayValue}</span></div>
              <MiniBar percent={factor.score} toneClassName={toneClasses[factor.tone].dot} />
            </div>
          ))}
        </div>
      </DetailDrawer>
    </div>
  );
}
