"use client";

import { useState } from "react";
import { Check, ShieldCheck, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { setGatePassStatus } from "@/lib/services/communication-service";
import { roleLabels } from "@/lib/permissions/roles";
import { gatePassStatusLabels, gatePassStatusTone, gatePassTypeLabels } from "@/lib/types/communication";
import { timeAgo } from "@/lib/utils";

export default function GatePassesPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [tab, setTab] = useState<"pending" | "active" | "all">("pending");
  const [, force] = useState(0);

  if (!can("frontdesk.view")) return <PermissionDenied action="view gate passes" role={roleLabels[role]} backHref="/front-desk" />;
  const canApprove = can("gatepass.approve") || can("frontdesk.manage");

  const rows = db.gatePasses.filter((g) => {
    if (tab === "pending") return g.status === "requested";
    if (tab === "active") return g.status === "approved" || g.status === "active";
    return true;
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Gate passes</h1>
          <p className="text-xs text-muted-foreground">{db.gatePasses.filter((g) => g.status === "requested").length} awaiting approval</p>
        </div>
        <div className="inline-flex rounded-md border border-border p-0.5">
          {(["pending", "active", "all"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`rounded px-sm py-1.5 text-xs font-medium capitalize ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{t}</button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
          <ShieldCheck className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No gate passes in this view.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-sm">
          {rows.map((g) => (
            <div key={g.id} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{g.subjectName} <span className="text-xs text-muted-foreground">· {gatePassTypeLabels[g.type]}</span></p>
                <p className="truncate text-xs text-muted-foreground">{g.reference} · {g.reason}{g.classOrDept ? ` · ${g.classOrDept}` : ""} · {timeAgo(g.createdAt)}</p>
                {g.guardianName && <p className="text-xs text-muted-foreground">Guardian: {g.guardianName}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-xs">
                <Badge tone={gatePassStatusTone[g.status]}>{gatePassStatusLabels[g.status]}</Badge>
                {canApprove && g.status === "requested" && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => { setGatePassStatus(g.id, "approved", "Principal"); force((n) => n + 1); }}><Check className="size-3.5" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => { setGatePassStatus(g.id, "rejected"); force((n) => n + 1); }}><X className="size-3.5" /></Button>
                  </>
                )}
                {canApprove && g.status === "approved" && <Button size="sm" variant="outline" onClick={() => { setGatePassStatus(g.id, "active"); force((n) => n + 1); }}>Activate</Button>}
                {canApprove && g.status === "active" && <Button size="sm" variant="ghost" onClick={() => { setGatePassStatus(g.id, "returned"); force((n) => n + 1); }}>Mark returned</Button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
