"use client";

import Link from "next/link";
import { useMemo } from "react";
import { CalendarDays, Trophy, Users, Volleyball } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { sportCategoryLabels } from "@/lib/types/activities";

export default function SportsDashboardPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();

  const stats = useMemo(() => ({
    teams: db.sportsTeams.length,
    players: db.teamMembers.length,
    fixtures: db.fixtures.filter((f) => f.status === "scheduled" || f.status === "live").length,
    tournaments: db.tournaments.filter((t) => t.status !== "completed").length,
  }), [db]);

  if (!can("activities.view")) return <PermissionDenied action="view sports" role={roleLabels[role]} backHref="/activities" />;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-lg font-semibold text-foreground">Sports</h1><p className="text-xs text-muted-foreground">{db.sports.length} sports · {stats.teams} teams</p></div>
        <div className="flex gap-xs">
          <Button asChild size="sm" variant="outline"><Link href="/activities/sports/fixtures"><CalendarDays className="size-3.5" /> Fixtures</Link></Button>
          <Button asChild size="sm" variant="outline"><Link href="/activities/sports/tournaments"><Trophy className="size-3.5" /> Tournaments</Link></Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Teams" value={String(stats.teams)} icon={Users} tone="info" />
        <StatTile label="Players" value={String(stats.players)} icon={Volleyball} tone="neutral" />
        <StatTile label="Upcoming fixtures" value={String(stats.fixtures)} icon={CalendarDays} tone="warning" />
        <StatTile label="Active tournaments" value={String(stats.tournaments)} icon={Trophy} tone="success" />
      </div>

      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2 lg:grid-cols-3">
        {db.sports.map((sp) => (
          <Link key={sp.id} href={`/activities/sports/${sp.id}`} className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md transition hover:border-primary/40">
            <div className="flex items-start justify-between gap-sm">
              <div className="flex items-center gap-2"><span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary"><Volleyball className="size-4" /></span><div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{sp.name}</p><p className="truncate text-xs text-muted-foreground">{sportCategoryLabels[sp.category]} · {sp.season}</p></div></div>
              <Badge tone={sp.status === "active" ? "success" : "neutral"}>{sp.status}</Badge>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{sp.teamCount} teams · {sp.playerCount} players</span><span>Coach {sp.coachName}</span></div>
          </Link>
        ))}
      </div>
    </div>
  );
}
