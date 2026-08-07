"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowLeft, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { houseStandings } from "@/lib/selectors/activities-brief";
import { roleLabels } from "@/lib/permissions/roles";
import { housePointReasonLabels } from "@/lib/types/activities";
import { formatDate } from "@/lib/utils";

const PODIUM_ORDER = [1, 0, 2]; // silver, gold, bronze visual order

export default function HouseLeaderboardPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const standings = useMemo(() => houseStandings(db), [db]);
  const recent = useMemo(() => [...db.housePoints].sort((a, b) => b.awardedAt.localeCompare(a.awardedAt)).slice(0, 12), [db.housePoints]);
  const houseName = (hid: string) => db.houses.find((h) => h.id === hid)?.name ?? hid;

  if (!can("activities.view")) return <PermissionDenied action="view the leaderboard" role={roleLabels[role]} backHref="/activities/houses" />;

  const top3 = standings.slice(0, 3);
  const heights = ["h-28", "h-36", "h-20"]; // matches PODIUM_ORDER indexes

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="ghost"><Link href="/activities/houses"><ArrowLeft className="size-4" /></Link></Button>
        <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><Trophy className="size-5 text-primary" /> House leaderboard</h1><p className="text-xs text-muted-foreground">Live standings from the points ledger</p></div>
      </div>

      {/* Podium */}
      <div className="rounded-lg border border-border bg-surface p-md">
        <div className="flex items-end justify-center gap-3 sm:gap-6">
          {PODIUM_ORDER.map((rankIdx, i) => {
            const h = top3[rankIdx];
            if (!h) return <div key={i} className="w-24" />;
            return (
              <div key={h.id} className="flex w-24 flex-col items-center gap-1 sm:w-28">
                <span className="text-3xl" aria-hidden>{h.emblem}</span>
                <span className="text-sm font-semibold text-foreground">{h.name}</span>
                <span className="text-xs text-muted-foreground">{h.totalPoints} pts</span>
                <div className={`flex ${heights[i]} w-full items-start justify-center rounded-t-lg pt-2 text-lg font-bold text-white`} style={{ backgroundColor: h.color }}>#{h.rank}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Full standings */}
      <div className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">Full standings</h2>
        <div className="flex flex-col gap-xs">
          {standings.map((h) => (
            <Link key={h.id} href={`/activities/houses/${h.id}`} className="flex items-center gap-sm rounded-md border border-border p-sm transition hover:border-primary/40">
              <span className="flex size-7 items-center justify-center rounded-md text-sm font-bold" style={{ backgroundColor: `${h.color}22`, color: h.color }}>{h.rank}</span>
              <span className="text-lg" aria-hidden>{h.emblem}</span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{h.name}</span>
              <span className="text-sm font-semibold tabular-nums text-foreground">{h.totalPoints}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent point movements (audit-style) */}
      <div className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">Recent point movements</h2>
        <div className="flex flex-col gap-xs">
          {recent.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm text-sm">
              <div className="min-w-0"><p className="truncate text-foreground">{houseName(e.houseId)} · {housePointReasonLabels[e.reason]}</p><p className="truncate text-xs text-muted-foreground">{e.description} · {e.awardedBy} · {formatDate(e.awardedAt.slice(0, 10))}</p></div>
              <span className={`text-sm font-semibold tabular-nums ${e.points >= 0 ? "text-success" : "text-error"}`}>{e.points >= 0 ? "+" : ""}{e.points}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
