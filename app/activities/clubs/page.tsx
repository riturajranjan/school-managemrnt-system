"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Users2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { clubCategoryLabels } from "@/lib/types/activities";
import type { ClubCategory } from "@/lib/types/activities";

const statusTone = { active: "success", recruiting: "info", paused: "warning", archived: "neutral" } as const;

export default function ClubsListPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [category, setCategory] = useState<ClubCategory | "all">("all");

  const clubs = useMemo(() => db.clubs.filter((c) => (category === "all" ? true : c.category === category)), [db.clubs, category]);

  if (!can("activities.view")) return <PermissionDenied action="view clubs" role={roleLabels[role]} backHref="/activities" />;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-lg font-semibold text-foreground">Clubs & societies</h1><p className="text-xs text-muted-foreground">{db.clubs.length} clubs · {db.clubMemberships.filter((m) => m.status === "active").length} active members</p></div>
        <select value={category} onChange={(e) => setCategory(e.target.value as ClubCategory | "all")} className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-foreground">
          <option value="all">All categories</option>
          {Object.entries(clubCategoryLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2 lg:grid-cols-3">
        {clubs.map((c) => (
          <Link key={c.id} href={`/activities/clubs/${c.id}`} className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md transition hover:border-primary/40">
            <div className="flex items-start justify-between gap-sm">
              <div className="flex items-center gap-2"><span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary"><Users2 className="size-4" /></span><div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{c.name}</p><p className="truncate text-xs text-muted-foreground">{clubCategoryLabels[c.category]}</p></div></div>
              <Badge tone={statusTone[c.status]}>{c.status}</Badge>
            </div>
            <p className="line-clamp-2 text-xs text-muted-foreground">{c.description}</p>
            <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{c.memberCount}/{c.capacity} members</span><span>{c.meetingSchedule}</span></div>
            <div className="h-1.5 w-full overflow-hidden rounded-pill bg-surface-secondary"><div className="h-full rounded-pill bg-primary" style={{ width: `${Math.min(100, Math.round((c.memberCount / c.capacity) * 100))}%` }} /></div>
          </Link>
        ))}
        {clubs.length === 0 && <div className="col-span-full rounded-lg border border-dashed border-border p-2xl text-center text-sm text-muted-foreground">No clubs in this category.</div>}
      </div>
    </div>
  );
}
