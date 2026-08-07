"use client";

import Link from "next/link";
import { useMemo } from "react";
import { History, Shield, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { houseStandings } from "@/lib/selectors/activities-brief";
import { roleLabels } from "@/lib/permissions/roles";

export default function HousesDashboardPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const standings = useMemo(() => houseStandings(db), [db]);

  if (!can("activities.view")) return <PermissionDenied action="view the house system" role={roleLabels[role]} backHref="/activities" />;

  const max = Math.max(1, ...standings.map((h) => h.totalPoints));

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><Shield className="size-5 text-primary" /> House system</h1><p className="text-xs text-muted-foreground">{standings.length} houses</p></div>
        <div className="flex gap-xs">
          <Button asChild size="sm" variant="outline"><Link href="/activities/houses/leaderboard"><Trophy className="size-3.5" /> Leaderboard</Link></Button>
          {can("activities.awardPoints") && <Button asChild size="sm"><Link href="/activities/houses/points"><History className="size-3.5" /> Award points</Link></Button>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
        {standings.map((h) => (
          <Link key={h.id} href={`/activities/houses/${h.id}`} className="surface-3d flex flex-col gap-sm rounded-lg border-l-4 border border-border bg-surface p-md transition hover:border-primary/40" style={{ borderLeftColor: h.color }}>
            <div className="flex items-center justify-between gap-sm">
              <div className="flex items-center gap-2"><span className="text-2xl" aria-hidden>{h.emblem}</span><div><p className="text-sm font-semibold text-foreground">{h.name}</p><p className="text-xs italic text-muted-foreground">“{h.motto}”</p></div></div>
              <span className="flex size-8 items-center justify-center rounded-full text-sm font-bold" style={{ backgroundColor: `${h.color}22`, color: h.color }}>#{h.rank}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{h.memberCount} members · Captain {h.captainName}</span><span className="text-sm font-semibold text-foreground">{h.totalPoints} pts</span></div>
            <div className="h-2 w-full overflow-hidden rounded-pill bg-surface-secondary"><div className="h-full rounded-pill" style={{ width: `${Math.round((h.totalPoints / max) * 100)}%`, backgroundColor: h.color }} /></div>
          </Link>
        ))}
      </div>
    </div>
  );
}
