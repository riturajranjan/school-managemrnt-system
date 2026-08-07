"use client";

import Link from "next/link";
import { ArrowLeft, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { tournamentFormatLabels } from "@/lib/types/activities";
import { formatDate } from "@/lib/utils";

const statusTone = { upcoming: "info", ongoing: "success", completed: "neutral" } as const;

export default function TournamentsPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();

  if (!can("activities.view")) return <PermissionDenied action="view tournaments" role={roleLabels[role]} backHref="/activities/sports" />;

  const sportName = (sid: string) => db.sports.find((s) => s.id === sid)?.name ?? sid;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="ghost"><Link href="/activities/sports"><ArrowLeft className="size-4" /></Link></Button>
        <div><h1 className="text-lg font-semibold text-foreground">Tournaments</h1><p className="text-xs text-muted-foreground">{db.tournaments.length} tournaments</p></div>
      </div>

      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
        {db.tournaments.map((t) => (
          <Link key={t.id} href={`/activities/sports/tournaments/${t.id}`} className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md transition hover:border-primary/40">
            <div className="flex items-start justify-between gap-sm">
              <div className="flex items-center gap-2"><span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary"><Trophy className="size-4" /></span><div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{t.name}</p><p className="truncate text-xs text-muted-foreground">{sportName(t.sportId)} · {tournamentFormatLabels[t.format]}</p></div></div>
              <Badge tone={statusTone[t.status]}>{t.status}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{t.teamCount} teams · {formatDate(t.startDate)} – {formatDate(t.endDate)}</p>
            {t.championTeam && <p className="text-xs text-foreground">🏆 Champion: <span className="font-medium">{t.championTeam}</span></p>}
          </Link>
        ))}
      </div>
    </div>
  );
}
