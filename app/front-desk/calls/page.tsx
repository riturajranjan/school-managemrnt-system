"use client";

import { useState } from "react";
import { Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { setCallFollowUp } from "@/lib/services/communication-service";
import { roleLabels } from "@/lib/permissions/roles";
import { callTypeLabels } from "@/lib/types/communication";

export default function CallLogPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [, force] = useState(0);
  if (!can("frontdesk.view")) return <PermissionDenied action="view the call log" role={roleLabels[role]} backHref="/front-desk" />;
  const canManage = can("frontdesk.manage");

  const calls = [...db.receptionCalls].sort((a, b) => b.time.localeCompare(a.time));

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Call log</h1>
        <p className="text-xs text-muted-foreground">{calls.filter((c) => c.followUpNeeded).length} need follow-up</p>
      </div>

      <div className="flex flex-col gap-sm">
        {calls.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
            <div className="flex min-w-0 items-center gap-sm">
              <span className={`flex size-9 shrink-0 items-center justify-center rounded-md ${c.type === "emergency" ? "bg-error/10 text-error" : "bg-primary/10 text-primary"}`}><Phone className="size-4" /></span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{c.callerName} <span className="text-xs text-muted-foreground">· {callTypeLabels[c.type]}</span></p>
                <p className="truncate text-xs text-muted-foreground">{c.subject} · {c.department} · {c.time}{c.relatedTo ? ` · re: ${c.relatedTo}` : ""}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-xs">
              <Badge tone={c.outcome === "resolved" ? "success" : c.outcome === "callback-needed" ? "warning" : "neutral"}>{c.outcome.replace("-", " ")}</Badge>
              {canManage && c.followUpNeeded && <Button size="sm" variant="outline" onClick={() => { setCallFollowUp(c.id, true); force((n) => n + 1); }}>Mark done</Button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
