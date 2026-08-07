"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { setFixtureResult } from "@/lib/services/activities-service";
import { roleLabels } from "@/lib/permissions/roles";
import { fixtureStatusLabels, fixtureStatusTone } from "@/lib/types/activities";
import type { FixtureStatus } from "@/lib/types/activities";
import { formatDate } from "@/lib/utils";

export default function FixturesPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [, force] = useState(0);
  const [filter, setFilter] = useState<FixtureStatus | "all">("all");

  const fixtures = useMemo(() => [...db.fixtures].filter((f) => (filter === "all" ? true : f.status === filter)).sort((a, b) => a.date.localeCompare(b.date)), [db.fixtures, filter]);
  const sportName = (sid: string) => db.sports.find((s) => s.id === sid)?.name ?? sid;

  if (!can("activities.view")) return <PermissionDenied action="view fixtures" role={roleLabels[role]} backHref="/activities/sports" />;

  const canManage = can("activities.manageSports") || can("activities.recordResults");
  const filters: (FixtureStatus | "all")[] = ["all", "scheduled", "live", "completed", "postponed"];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="ghost"><Link href="/activities/sports"><ArrowLeft className="size-4" /></Link></Button>
        <div><h1 className="text-lg font-semibold text-foreground">Fixtures</h1><p className="text-xs text-muted-foreground">{fixtures.length} fixtures</p></div>
      </div>

      <div className="flex flex-wrap gap-1">
        {filters.map((f) => <button key={f} type="button" onClick={() => setFilter(f)} className={`rounded-pill px-2.5 py-1 text-xs font-medium capitalize transition ${filter === f ? "bg-primary text-primary-foreground" : "bg-surface-secondary text-muted-foreground hover:text-foreground"}`}>{f === "all" ? "All" : fixtureStatusLabels[f]}</button>)}
      </div>

      <div className="flex flex-col gap-xs">
        {fixtures.map((f) => (
          <div key={f.id} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm text-sm">
            <div className="min-w-0"><p className="truncate text-foreground">{f.homeTeam} <span className="text-muted-foreground">vs</span> {f.awayTeam}</p><p className="truncate text-xs text-muted-foreground">{sportName(f.sportId)} · {formatDate(f.date)} {f.time} · {f.venue}</p></div>
            <div className="flex items-center gap-2">
              {f.status === "completed" && f.homeScore != null && <span className="text-sm font-semibold tabular-nums text-foreground">{f.homeScore}–{f.awayScore}</span>}
              {canManage && f.status !== "completed" && <Button size="sm" variant="outline" onClick={() => { setFixtureResult(f.id, 2, 1); force((n) => n + 1); }}>Record 2–1</Button>}
              <Badge tone={fixtureStatusTone[f.status]}>{fixtureStatusLabels[f.status]}</Badge>
            </div>
          </div>
        ))}
        {fixtures.length === 0 && <div className="rounded-lg border border-dashed border-border p-2xl text-center text-sm text-muted-foreground">No fixtures.</div>}
      </div>
    </div>
  );
}
