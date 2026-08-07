"use client";

import Link from "next/link";
import { use, useMemo } from "react";
import { ArrowLeft, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { resultPositionLabels, resultPositionTone } from "@/lib/types/activities";
import { formatDate } from "@/lib/utils";

export default function EventResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const db = useSisStore();
  const { can, role } = usePermissions();

  const event = db.schoolEvents.find((e) => e.id === id);
  const results = useMemo(() => [...db.eventResults.filter((r) => r.eventId === id)].sort((a, b) => a.position.localeCompare(b.position)), [db.eventResults, id]);
  const studentName = (sid?: string) => { if (!sid) return null; const s = db.students.find((x) => x.id === sid); return s ? `${s.profile.firstName} ${s.profile.lastName}` : sid; };
  const houseName = (hid?: string) => db.houses.find((h) => h.id === hid)?.name;

  if (!can("activities.view")) return <PermissionDenied action="view results" role={roleLabels[role]} backHref="/activities/events" />;
  if (!event) return <div className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Event not found. <Link href="/activities/events" className="text-primary">Back</Link></div>;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="ghost"><Link href={`/activities/events/${id}`}><ArrowLeft className="size-4" /></Link></Button>
        <div><h1 className="text-lg font-semibold text-foreground">Results</h1><p className="text-xs text-muted-foreground">{event.title}</p></div>
      </div>

      {results.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border p-2xl text-center"><Trophy className="size-6 text-muted-foreground" /><p className="text-sm text-muted-foreground">No results recorded{event.stage !== "completed" ? " — available once the event is completed." : "."}</p></div>
      ) : (
        <div className="flex flex-col gap-xs">
          {results.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{studentName(r.studentId) ?? r.teamName ?? houseName(r.houseId) ?? "—"}</p>
                <p className="truncate text-xs text-muted-foreground">{r.citation} · recorded by {r.recordedBy} · {formatDate(r.recordedAt)}</p>
              </div>
              <div className="flex items-center gap-2">
                {r.houseId && houseName(r.houseId) && <Badge tone="info">{houseName(r.houseId)}</Badge>}
                {r.points > 0 && <span className="text-xs font-semibold text-foreground">+{r.points} pts</span>}
                <Badge tone={resultPositionTone[r.position]}>{resultPositionLabels[r.position]}</Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
