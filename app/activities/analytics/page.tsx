"use client";

import { useMemo } from "react";
import { BarChart3, Info } from "lucide-react";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { activitiesSummary, houseStandings } from "@/lib/selectors/activities-brief";
import { roleLabels } from "@/lib/permissions/roles";
import { clubCategoryLabels, eventCategoryLabels } from "@/lib/types/activities";
import type { ClubCategory, EventCategory } from "@/lib/types/activities";

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color?: string }) {
  return (
    <div className="flex items-center gap-sm text-sm">
      <span className="w-28 shrink-0 truncate text-muted-foreground">{label}</span>
      <div className="h-3 flex-1 overflow-hidden rounded-pill bg-surface-secondary"><div className="h-full rounded-pill" style={{ width: `${max > 0 ? Math.round((value / max) * 100) : 0}%`, backgroundColor: color ?? "var(--color-primary, #18b0c8)" }} /></div>
      <span className="w-8 text-right tabular-nums text-foreground">{value}</span>
    </div>
  );
}

export default function ActivitiesAnalyticsPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();

  const summary = useMemo(() => activitiesSummary(db), [db]);
  const standings = useMemo(() => houseStandings(db), [db]);
  const eventsByCategory = useMemo(() => {
    const counts = {} as Record<EventCategory, number>;
    db.schoolEvents.forEach((e) => { counts[e.category] = (counts[e.category] ?? 0) + 1; });
    return counts;
  }, [db.schoolEvents]);
  const clubsByCategory = useMemo(() => {
    const counts = {} as Record<ClubCategory, number>;
    db.clubs.forEach((c) => { counts[c.category] = (counts[c.category] ?? 0) + 1; });
    return counts;
  }, [db.clubs]);

  // Aggregate participation breadth — how many distinct students engage across
  // events/clubs/sports. Headcount only; not a per-student profile.
  const engaged = useMemo(() => {
    const set = new Set<string>();
    db.eventRegistrations.forEach((r) => set.add(r.studentId));
    db.clubMemberships.forEach((m) => set.add(m.studentId));
    db.teamMembers.forEach((tm) => set.add(tm.studentId));
    return set.size;
  }, [db]);

  if (!can("activities.viewAnalytics")) return <PermissionDenied action="view activity analytics" role={roleLabels[role]} backHref="/activities" />;

  const maxEvent = Math.max(1, ...Object.values(eventsByCategory));
  const maxClub = Math.max(1, ...Object.values(clubsByCategory));
  const maxHouse = Math.max(1, ...standings.map((h) => h.totalPoints));
  const engagedPct = db.students.length ? Math.round((engaged / db.students.length) * 100) : 0;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><BarChart3 className="size-5 text-primary" /> Activity analytics</h1><p className="text-xs text-muted-foreground">Aggregate participation & operations</p></div>

      <div className="rounded-md border border-primary/25 bg-primary/5 p-sm text-xs text-primary flex items-start gap-2"><Info className="mt-0.5 size-3.5 shrink-0" /> These are aggregate counts of activity across the school. They never rank, score or profile any individual student&apos;s talent, personality or worth.</div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Participation" value={`${engagedPct}%`} tone="success" hint={`${engaged}/${db.students.length} students`} />
        <StatTile label="Events" value={String(summary.totalEvents)} tone="info" />
        <StatTile label="Clubs" value={String(summary.totalClubs)} tone="neutral" />
        <StatTile label="House points" value={String(summary.totalHousePoints)} tone="info" />
      </div>

      <div className="grid grid-cols-1 gap-md lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm text-sm font-semibold text-foreground">Events by category</h2>
          <div className="flex flex-col gap-2">{Object.entries(eventsByCategory).map(([k, v]) => <Bar key={k} label={eventCategoryLabels[k as EventCategory]} value={v} max={maxEvent} />)}</div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm text-sm font-semibold text-foreground">Clubs by category</h2>
          <div className="flex flex-col gap-2">{Object.entries(clubsByCategory).map(([k, v]) => <Bar key={k} label={clubCategoryLabels[k as ClubCategory]} value={v} max={maxClub} />)}</div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-md lg:col-span-2">
          <h2 className="mb-sm text-sm font-semibold text-foreground">House points</h2>
          <div className="flex flex-col gap-2">{standings.map((h) => <Bar key={h.id} label={h.name} value={h.totalPoints} max={maxHouse} color={h.color} />)}</div>
        </div>
      </div>
    </div>
  );
}
