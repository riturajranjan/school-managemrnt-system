"use client";

import Link from "next/link";
import { Sparkles, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { awardTypeLabels, eventCategoryLabels } from "@/lib/types/activities";
import { formatDate } from "@/lib/utils";

const recipientTone = { student: "info", house: "success", team: "warning", club: "neutral" } as const;

export default function AwardsPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();

  if (!can("activities.view")) return <PermissionDenied action="view awards" role={roleLabels[role]} backHref="/activities" />;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><Trophy className="size-5 text-primary" /> Awards</h1><p className="text-xs text-muted-foreground">{db.awards.length} awards presented</p></div>
        {can("activities.manageCertificates") && <Button asChild size="sm" variant="outline"><Link href="/activities/certificates/ceremony"><Sparkles className="size-3.5" /> Ceremony mode</Link></Button>}
      </div>

      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2 lg:grid-cols-3">
        {db.awards.map((a) => (
          <div key={a.id} className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
            <div className="flex items-start justify-between gap-sm">
              <div className="flex items-center gap-2"><span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary"><Trophy className="size-4" /></span><div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{a.name}</p><p className="truncate text-xs text-muted-foreground">{awardTypeLabels[a.type]} · {eventCategoryLabels[a.category]}</p></div></div>
              <Badge tone={recipientTone[a.recipientType]}>{a.recipientType}</Badge>
            </div>
            <p className="text-sm text-foreground">{a.recipientName}</p>
            <p className="line-clamp-2 text-xs italic text-muted-foreground">“{a.citation}”</p>
            <p className="text-xs text-muted-foreground">{a.ceremony} · {formatDate(a.awardedAt)} · by {a.presentedBy}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
