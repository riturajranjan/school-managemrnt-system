"use client";

import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { usePolicies } from "@/lib/hooks/use-admin";
import { roleLabels } from "@/lib/permissions/roles";
import { formatDate } from "@/lib/utils";

export default function PoliciesPage() {
  const { role } = usePermissions();
  const policies = usePolicies();
  const canView = role === "super-admin" || role === "administrator" || role === "principal";
  if (!canView) return <PermissionDenied action="view policies" role={roleLabels[role]} backHref="/settings" />;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><FileText className="size-5 text-primary" /> School policies</h1><p className="text-xs text-muted-foreground">{policies.length} policies</p></div>
      <div className="flex flex-col gap-xs">
        {policies.map((p) => (
          <div key={p.id} className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0"><div className="flex items-center gap-2"><p className="text-sm font-medium text-foreground">{p.name}</p><Badge tone="neutral">{p.version}</Badge><Badge tone={p.status === "published" ? "success" : "warning"}>{p.status}</Badge></div><p className="text-xs text-muted-foreground">Effective {formatDate(p.effectiveDate)} · Audience: {p.audience}</p></div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><span>Acknowledged</span><div className="h-1.5 w-24 overflow-hidden rounded-pill bg-surface-secondary"><div className="h-full rounded-pill bg-success" style={{ width: `${p.acknowledged}%` }} /></div><span className="tabular-nums text-foreground">{p.acknowledged}%</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}
