"use client";

import Link from "next/link";
import { use, useMemo, useState } from "react";
import { ArrowLeft, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { setBracketResult } from "@/lib/services/activities-service";
import { roleLabels } from "@/lib/permissions/roles";
import { tournamentFormatLabels } from "@/lib/types/activities";
import { formatDate } from "@/lib/utils";

export default function TournamentBracketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [, force] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const tournament = db.tournaments.find((t) => t.id === id);
  const matches = useMemo(() => db.bracketMatches.filter((m) => m.tournamentId === id), [db.bracketMatches, id]);

  if (!can("activities.view")) return <PermissionDenied action="view this tournament" role={roleLabels[role]} backHref="/activities/sports/tournaments" />;
  if (!tournament) return <div className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Tournament not found. <Link href="/activities/sports/tournaments" className="text-primary">Back</Link></div>;

  const canManage = can("activities.manageSports") || can("activities.recordResults");
  const rounds = Array.from(new Set(matches.map((m) => m.round))).sort((a, b) => a - b);

  const recordDemo = (matchId: string) => { const r = setBracketResult(matchId, 3, 1); if (!r.ok) setError(r.error); else setError(null); force((n) => n + 1); };

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="ghost"><Link href="/activities/sports/tournaments"><ArrowLeft className="size-4" /></Link></Button>
        <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><Trophy className="size-5 text-primary" /> {tournament.name}</h1><p className="text-xs text-muted-foreground">{tournamentFormatLabels[tournament.format]} · {formatDate(tournament.startDate)} – {formatDate(tournament.endDate)}</p></div>
      </div>

      {error && <p className="rounded-md border border-error/30 bg-error/8 p-sm text-xs text-error">{error}</p>}

      {tournament.format === "knockout" && matches.length > 0 ? (
        <div className="overflow-x-auto">
          <div className="flex min-w-max gap-6 p-2">
            {rounds.map((round) => {
              const roundMatches = matches.filter((m) => m.round === round).sort((a, b) => a.slot - b.slot);
              return (
                <div key={round} className="flex min-w-52 flex-col justify-around gap-4">
                  <p className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">{roundMatches[0]?.roundLabel ?? `Round ${round}`}</p>
                  {roundMatches.map((m) => (
                    <div key={m.id} className="rounded-lg border border-border bg-surface p-2">
                      {[["A", m.teamA, m.scoreA], ["B", m.teamB, m.scoreB]].map(([side, team, score]) => (
                        <div key={side as string} className={`flex items-center justify-between gap-2 rounded px-2 py-1 text-sm ${m.winner && m.winner === team ? "bg-success/10 font-semibold text-foreground" : "text-muted-foreground"}`}>
                          <span className="min-w-0 truncate">{(team as string) ?? "TBD"}</span>
                          <span className="tabular-nums">{score != null ? (score as number) : "–"}</span>
                        </div>
                      ))}
                      {canManage && m.status !== "completed" && m.teamA && m.teamB && (
                        <Button size="sm" variant="outline" className="mt-1 w-full" onClick={() => recordDemo(m.id)}>Record 3–1</Button>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-surface p-md text-sm text-muted-foreground">
          {tournament.championTeam ? (
            <div className="flex flex-col gap-1"><p className="text-foreground">🏆 Champion: <span className="font-semibold">{tournament.championTeam}</span></p>{tournament.runnerUpTeam && <p>🥈 Runner-up: {tournament.runnerUpTeam}</p>}</div>
          ) : <p>This {tournamentFormatLabels[tournament.format].toLowerCase()} tournament has no knockout bracket. {tournament.teamCount} teams competing.</p>}
        </div>
      )}
    </div>
  );
}
