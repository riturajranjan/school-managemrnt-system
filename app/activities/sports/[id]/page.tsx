"use client";

import Link from "next/link";
import { use, useMemo, useState } from "react";
import { ArrowLeft, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { setFixtureResult } from "@/lib/services/activities-service";
import { roleLabels } from "@/lib/permissions/roles";
import { fixtureStatusLabels, fixtureStatusTone, sportCategoryLabels, teamAgeGroupLabels } from "@/lib/types/activities";
import { formatDate } from "@/lib/utils";

export default function SportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [, force] = useState(0);

  const sport = db.sports.find((s) => s.id === id);
  const teams = useMemo(() => db.sportsTeams.filter((t) => t.sportId === id), [db.sportsTeams, id]);
  const fixtures = useMemo(() => [...db.fixtures.filter((f) => f.sportId === id)].sort((a, b) => a.date.localeCompare(b.date)), [db.fixtures, id]);

  if (!can("activities.view")) return <PermissionDenied action="view this sport" role={roleLabels[role]} backHref="/activities/sports" />;
  if (!sport) return <div className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Sport not found. <Link href="/activities/sports" className="text-primary">Back</Link></div>;

  const canManage = can("activities.manageSports") || can("activities.recordResults");

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="ghost"><Link href="/activities/sports"><ArrowLeft className="size-4" /></Link></Button>
        <div><h1 className="text-lg font-semibold text-foreground">{sport.name}</h1><p className="text-xs text-muted-foreground">{sportCategoryLabels[sport.category]} · {sport.season} · Coach {sport.coachName}</p></div>
      </div>

      <section>
        <h2 className="mb-sm flex items-center gap-1 text-sm font-semibold text-foreground"><Users className="size-4" /> Teams</h2>
        <div className="grid grid-cols-1 gap-sm sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((t) => (
            <Link key={t.id} href={`/activities/sports/teams/${t.id}`} className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md transition hover:border-primary/40">
              <p className="text-sm font-semibold text-foreground">{t.name}</p>
              <p className="text-xs text-muted-foreground">{teamAgeGroupLabels[t.ageGroup]} · {t.memberCount} players</p>
              <div className="flex gap-2 text-xs"><span className="text-success">{t.wins}W</span><span className="text-error">{t.losses}L</span><span className="text-muted-foreground">{t.draws}D</span></div>
            </Link>
          ))}
          {teams.length === 0 && <p className="text-sm text-muted-foreground">No teams for this sport.</p>}
        </div>
      </section>

      <section>
        <h2 className="mb-sm text-sm font-semibold text-foreground">Fixtures</h2>
        <div className="flex flex-col gap-xs">
          {fixtures.map((f) => (
            <div key={f.id} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm text-sm">
              <div className="min-w-0"><p className="truncate text-foreground">{f.homeTeam} <span className="text-muted-foreground">vs</span> {f.awayTeam}</p><p className="truncate text-xs text-muted-foreground">{formatDate(f.date)} {f.time} · {f.venue}</p></div>
              <div className="flex items-center gap-2">
                {f.status === "completed" && f.homeScore != null && <span className="text-sm font-semibold tabular-nums text-foreground">{f.homeScore}–{f.awayScore}</span>}
                {canManage && f.status !== "completed" && <Button size="sm" variant="outline" onClick={() => { setFixtureResult(f.id, 2, 1); force((n) => n + 1); }}>Record 2–1</Button>}
                <Badge tone={fixtureStatusTone[f.status]}>{fixtureStatusLabels[f.status]}</Badge>
              </div>
            </div>
          ))}
          {fixtures.length === 0 && <p className="text-sm text-muted-foreground">No fixtures scheduled.</p>}
        </div>
      </section>
    </div>
  );
}
