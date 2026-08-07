"use client";

import Link from "next/link";
import { Medal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { competitionLevelLabels, eventCategoryLabels } from "@/lib/types/activities";
import { formatDate } from "@/lib/utils";

const statusTone = { open: "info", judging: "warning", "results-published": "success", closed: "neutral" } as const;
const statusLabel = { open: "Open", judging: "Judging", "results-published": "Results published", closed: "Closed" } as const;

export default function CompetitionsPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();

  if (!can("activities.view")) return <PermissionDenied action="view competitions" role={roleLabels[role]} backHref="/activities" />;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="text-lg font-semibold text-foreground">Competitions</h1><p className="text-xs text-muted-foreground">{db.competitions.length} competitions · human-judged scoring</p></div>

      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2 lg:grid-cols-3">
        {db.competitions.map((c) => (
          <Link key={c.id} href={`/activities/competitions/${c.id}`} className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md transition hover:border-primary/40">
            <div className="flex items-start justify-between gap-sm">
              <div className="flex items-center gap-2"><span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary"><Medal className="size-4" /></span><div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{c.name}</p><p className="truncate text-xs text-muted-foreground">{eventCategoryLabels[c.category]} · {competitionLevelLabels[c.level]}</p></div></div>
              <Badge tone={statusTone[c.status]}>{statusLabel[c.status]}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{formatDate(c.date)} · {c.venue} · {c.participantCount} entries</p>
            <div className="flex flex-wrap gap-1">{c.criteria.map((cr) => <span key={cr.id} className="rounded-pill bg-surface-secondary px-2 py-0.5 text-[10px] text-muted-foreground">{cr.label} ×{cr.weight}%</span>)}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
