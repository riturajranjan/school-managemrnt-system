"use client";

import { useMemo, useState } from "react";
import { Award, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { achievementLevelLabels, achievementLevelTone, eventCategoryLabels, resultPositionLabels } from "@/lib/types/activities";
import type { AchievementLevel } from "@/lib/types/activities";
import { formatDate } from "@/lib/utils";

export default function AchievementsPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<AchievementLevel | "all">("all");

  const studentName = (sid: string) => { const s = db.students.find((x) => x.id === sid); return s ? `${s.profile.firstName} ${s.profile.lastName}` : sid; };
  const achievements = useMemo(() => {
    const q = query.trim().toLowerCase();
    const name = (sid: string) => { const s = db.students.find((x) => x.id === sid); return s ? `${s.profile.firstName} ${s.profile.lastName}` : sid; };
    return [...db.achievements]
      .filter((a) => (level === "all" ? true : a.level === level))
      .filter((a) => (q ? a.title.toLowerCase().includes(q) || name(a.studentId).toLowerCase().includes(q) : true))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [db.achievements, db.students, query, level]);

  if (!can("activities.view")) return <PermissionDenied action="view achievements" role={roleLabels[role]} backHref="/activities" />;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="text-lg font-semibold text-foreground">Achievements</h1><p className="text-xs text-muted-foreground">{db.achievements.length} student achievements recorded</p></div>

      <div className="flex flex-col gap-sm sm:flex-row sm:items-center">
        <div className="relative flex-1"><Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search achievements or students…" className="w-full rounded-md border border-border bg-surface py-1.5 pl-8 pr-3 text-sm text-foreground outline-none focus:border-primary" /></div>
        <select value={level} onChange={(e) => setLevel(e.target.value as AchievementLevel | "all")} className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-foreground">
          <option value="all">All levels</option>
          {Object.entries(achievementLevelLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <div className="flex flex-col gap-xs">
        {achievements.map((a) => (
          <div key={a.id} className="flex items-start justify-between gap-sm rounded-lg border border-border bg-surface p-sm text-sm">
            <div className="flex items-start gap-2"><span className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary"><Award className="size-4" /></span><div className="min-w-0"><p className="truncate font-medium text-foreground">{a.title}</p><p className="truncate text-xs text-muted-foreground">{studentName(a.studentId)} · {eventCategoryLabels[a.category]} · {formatDate(a.date)}{a.position ? ` · ${resultPositionLabels[a.position]}` : ""}</p></div></div>
            <Badge tone={achievementLevelTone[a.level]}>{achievementLevelLabels[a.level]}</Badge>
          </div>
        ))}
        {achievements.length === 0 && <div className="rounded-lg border border-dashed border-border p-2xl text-center text-sm text-muted-foreground">No achievements match your filters.</div>}
      </div>
    </div>
  );
}
