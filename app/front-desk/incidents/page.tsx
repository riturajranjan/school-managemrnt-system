"use client";

import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { timeAgo } from "@/lib/utils";

export default function FrontDeskIncidentsPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  if (!can("frontdesk.view")) return <PermissionDenied action="view front-desk incidents" role={roleLabels[role]} backHref="/front-desk" />;

  const incidents = [...db.frontDeskIncidents].sort((a, b) => Number(a.status === "resolved") - Number(b.status === "resolved") || b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Front-desk incidents</h1>
        <p className="text-xs text-muted-foreground">Lost & found, security notes and reception incidents</p>
      </div>

      {incidents.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
          <AlertTriangle className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No incidents recorded.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-sm">
          {incidents.map((i) => (
            <div key={i.id} className="flex items-start justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
              <div className="flex min-w-0 items-start gap-sm">
                <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md ${i.severity === "high" ? "bg-error/10 text-error" : i.severity === "medium" ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary"}`}><AlertTriangle className="size-4" /></span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{i.title}</p>
                  <p className="text-xs text-muted-foreground">{i.description}</p>
                  <p className="text-xs text-muted-foreground">By {i.reportedBy} · {timeAgo(i.createdAt)}</p>
                </div>
              </div>
              <Badge tone={i.status === "resolved" ? "success" : "warning"}>{i.status}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
