"use client";

import Link from "next/link";
import { use, useMemo } from "react";
import { ArrowLeft, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { housePointReasonLabels } from "@/lib/types/activities";
import { formatDate } from "@/lib/utils";

export default function HouseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const db = useSisStore();
  const { can, role } = usePermissions();

  const house = db.houses.find((h) => h.id === id);
  const ledger = useMemo(() => [...db.housePoints.filter((e) => e.houseId === id)].sort((a, b) => b.awardedAt.localeCompare(a.awardedAt)), [db.housePoints, id]);
  const teams = useMemo(() => db.sportsTeams.filter((t) => t.houseId === id), [db.sportsTeams, id]);

  if (!can("activities.view")) return <PermissionDenied action="view this house" role={roleLabels[role]} backHref="/activities/houses" />;
  if (!house) return <div className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">House not found. <Link href="/activities/houses" className="text-primary">Back</Link></div>;

  const earned = ledger.filter((e) => e.points > 0).reduce((s, e) => s + e.points, 0);
  const deducted = ledger.filter((e) => e.points < 0).reduce((s, e) => s + e.points, 0);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="ghost"><Link href="/activities/houses"><ArrowLeft className="size-4" /></Link></Button>
        <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="text-2xl" aria-hidden>{house.emblem}</span><h1 className="truncate text-lg font-semibold text-foreground">{house.name}</h1><Badge tone="info">Rank #{house.rank}</Badge></div><p className="text-xs italic text-muted-foreground">“{house.motto}”</p></div>
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Total points" value={String(house.totalPoints)} tone="info" />
        <StatTile label="Earned" value={`+${earned}`} tone="success" />
        <StatTile label="Deducted" value={String(deducted)} tone={deducted < 0 ? "error" : "neutral"} />
        <StatTile label="Members" value={String(house.memberCount)} icon={Users} tone="neutral" />
      </div>

      <div className="rounded-lg border border-border bg-surface p-md text-sm">
        <div className="grid grid-cols-2 gap-y-1"><span className="text-muted-foreground">House Master</span><span className="text-foreground">{house.houseMasterName}</span><span className="text-muted-foreground">Captain</span><span className="text-foreground">{house.captainName}</span></div>
      </div>

      {teams.length > 0 && (
        <section>
          <h2 className="mb-sm text-sm font-semibold text-foreground">House teams</h2>
          <div className="flex flex-wrap gap-1">{teams.map((t) => <Link key={t.id} href={`/activities/sports/teams/${t.id}`} className="rounded-pill bg-surface-secondary px-2.5 py-1 text-xs text-foreground hover:text-primary">{t.name}</Link>)}</div>
        </section>
      )}

      {/* Points history (audit-style, append-only) */}
      <div className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">Points history</h2>
        <div className="flex flex-col gap-xs">
          {ledger.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm text-sm">
              <div className="min-w-0"><p className="truncate text-foreground">{housePointReasonLabels[e.reason]} — {e.description}</p><p className="truncate text-xs text-muted-foreground">{e.awardedBy} ({e.awardedByRole}) · {formatDate(e.awardedAt.slice(0, 10))}</p></div>
              <span className={`text-sm font-semibold tabular-nums ${e.points >= 0 ? "text-success" : "text-error"}`}>{e.points >= 0 ? "+" : ""}{e.points}</span>
            </div>
          ))}
          {ledger.length === 0 && <p className="py-md text-center text-sm text-muted-foreground">No point movements yet.</p>}
        </div>
      </div>
    </div>
  );
}
