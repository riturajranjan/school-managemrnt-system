"use client";

import { useState } from "react";
import { BookOpen, FileText, Link2, Search, Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { counsellingResourceCategoryLabels, type CounsellingResource } from "@/lib/types/health";
import { formatDate } from "@/lib/utils";

const formatIcon = { article: FileText, video: Video, worksheet: FileText, link: Link2 } as const;

export default function CounsellingResourcesPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [query, setQuery] = useState("");
  if (!can("counseling.view") && !can("counselling.viewOwn")) return <PermissionDenied action="view counselling resources" role={roleLabels[role]} backHref="/counselling" />;

  const q = query.trim().toLowerCase();
  const rows = db.counsellingResources.filter((r) => (q ? r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q) : true));

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="text-lg font-semibold text-foreground">Wellbeing resources</h1><p className="text-xs text-muted-foreground">School-provided guidance — educational, non-diagnostic</p></div>
      <div className="relative"><Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search resources…" className="pl-8" aria-label="Search" /></div>
      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center"><BookOpen className="size-6 text-muted-foreground" /><p className="text-sm text-muted-foreground">No resources match your search.</p></div>
      ) : (
        <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
          {rows.map((r: CounsellingResource) => { const Icon = formatIcon[r.format]; return (
            <div key={r.id} className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
              <div className="flex items-start justify-between gap-sm"><div className="flex items-center gap-sm"><span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary"><Icon className="size-4" /></span><p className="text-sm font-semibold text-foreground">{r.title}</p></div><Badge tone="neutral">{counsellingResourceCategoryLabels[r.category]}</Badge></div>
              <p className="text-sm text-muted-foreground">{r.description}</p>
              <p className="text-xs text-muted-foreground capitalize">{r.format} · updated {formatDate(r.updatedAt)}</p>
            </div>
          ); })}
        </div>
      )}
    </div>
  );
}
