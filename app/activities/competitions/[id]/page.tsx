"use client";

import Link from "next/link";
import { use, useMemo, useState } from "react";
import { ArrowLeft, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { recordCompetitionScore, setCompetitionStatus } from "@/lib/services/activities-service";
import { roleLabels } from "@/lib/permissions/roles";
import { competitionLevelLabels } from "@/lib/types/activities";
import type { Competition } from "@/lib/types/activities";
import { formatDate } from "@/lib/utils";

const statusOrder: Competition["status"][] = ["open", "judging", "results-published", "closed"];

export default function CompetitionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [, force] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const comp = db.competitions.find((c) => c.id === id);
  const participants = useMemo(() => {
    const list = db.competitionParticipants.filter((p) => p.competitionId === id);
    return [...list].sort((a, b) => (b.totalScore ?? -1) - (a.totalScore ?? -1));
  }, [db.competitionParticipants, id]);
  const studentName = (sid?: string) => { if (!sid) return "—"; const s = db.students.find((x) => x.id === sid); return s ? `${s.profile.firstName} ${s.profile.lastName}` : sid; };
  const houseName = (hid?: string) => db.houses.find((h) => h.id === hid)?.name;

  if (!can("activities.view")) return <PermissionDenied action="view this competition" role={roleLabels[role]} backHref="/activities/competitions" />;
  if (!comp) return <div className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Competition not found. <Link href="/activities/competitions" className="text-primary">Back</Link></div>;

  const canScore = can("activities.recordResults") || can("activities.manageCompetitions");
  const nextStatus = statusOrder[Math.min(statusOrder.indexOf(comp.status) + 1, statusOrder.length - 1)];

  const onScore = (participantId: string, criterionId: string, value: number) => {
    const r = recordCompetitionScore(participantId, criterionId, value);
    if (!r.ok) setError(r.error); else setError(null);
    force((n) => n + 1);
  };

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="ghost"><Link href="/activities/competitions"><ArrowLeft className="size-4" /></Link></Button>
        <div className="min-w-0 flex-1"><h1 className="truncate text-lg font-semibold text-foreground">{comp.name}</h1><p className="text-xs text-muted-foreground">{competitionLevelLabels[comp.level]} · {formatDate(comp.date)} · {comp.venue}</p></div>
        {canScore && comp.status !== "closed" && <Button size="sm" onClick={() => { setCompetitionStatus(id, nextStatus); force((n) => n + 1); }}>Mark {nextStatus.replace("-", " ")}</Button>}
      </div>

      <div className="rounded-md border border-primary/25 bg-primary/5 p-sm text-xs text-primary flex items-start gap-2"><Info className="mt-0.5 size-3.5 shrink-0" /> Scores are entered by human judges. There is no automated or AI scoring — the total is a transparent weighted sum of judge inputs.</div>

      {/* Scoring criteria (configurable weights) */}
      <div className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">Scoring criteria</h2>
        <div className="flex flex-wrap gap-2">
          {comp.criteria.map((cr) => (
            <div key={cr.id} className="rounded-md border border-border px-3 py-1.5 text-sm"><span className="font-medium text-foreground">{cr.label}</span><span className="ml-2 text-xs text-muted-foreground">max {cr.maxScore} · weight {cr.weight}%</span></div>
          ))}
        </div>
      </div>

      {error && <p className="rounded-md border border-error/30 bg-error/8 p-sm text-xs text-error">{error}</p>}

      {/* Participants + scoring */}
      <div className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">Participants ({participants.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-max text-sm">
            <thead><tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="py-2 pr-3">#</th><th className="py-2 pr-3">Entry</th>
              {comp.criteria.map((cr) => <th key={cr.id} className="py-2 pr-3">{cr.label}</th>)}
              <th className="py-2 pr-3 text-right">Total</th>
            </tr></thead>
            <tbody>
              {participants.map((p, i) => (
                <tr key={p.id} className="border-b border-border/60">
                  <td className="py-2 pr-3 font-medium text-muted-foreground">{p.totalScore != null ? i + 1 : "–"}</td>
                  <td className="py-2 pr-3"><div className="min-w-0"><p className="truncate text-foreground">{studentName(p.studentId)}</p><p className="text-xs text-muted-foreground">{p.entryNumber}{houseName(p.houseId) ? ` · ${houseName(p.houseId)}` : ""}</p></div></td>
                  {comp.criteria.map((cr) => (
                    <td key={cr.id} className="py-2 pr-3">
                      {canScore ? (
                        <Input type="number" min={0} max={cr.maxScore} defaultValue={p.scores[cr.id] ?? ""} className="w-16" onBlur={(e) => { const v = Number(e.target.value); if (!Number.isNaN(v) && e.target.value !== "") onScore(p.id, cr.id, v); }} />
                      ) : <span className="tabular-nums text-foreground">{p.scores[cr.id] ?? "–"}</span>}
                    </td>
                  ))}
                  <td className="py-2 pr-3 text-right font-semibold tabular-nums text-foreground">{p.totalScore != null ? p.totalScore.toFixed(1) : "–"}</td>
                </tr>
              ))}
              {participants.length === 0 && <tr><td colSpan={comp.criteria.length + 3} className="py-md text-center text-sm text-muted-foreground">No participants entered.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
