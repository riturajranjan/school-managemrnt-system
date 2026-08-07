"use client";

import { ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { formatDate } from "@/lib/utils";

const categoryTone: Record<string, "info" | "success" | "warning" | "neutral" | "error"> = {
  leave: "info", conduct: "warning", safety: "error", it: "info", finance: "warning", general: "neutral",
};

export default function PoliciesPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  if (!can("hr.view") && !can("hr.viewOwn")) return <PermissionDenied action="view policies" role={roleLabels[role]} backHref="/hr" />;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">HR policies</h1>
        <p className="text-xs text-muted-foreground">Policy library — acknowledge during onboarding</p>
      </div>

      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
        {db.hrPolicies.map((p) => (
          <div key={p.id} className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
            <div className="flex items-start justify-between gap-sm">
              <div className="flex items-center gap-sm">
                <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary"><ShieldCheck className="size-4" /></span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{p.title}</p>
                  <p className="text-xs text-muted-foreground">{p.version} · updated {formatDate(p.updatedAt)}</p>
                </div>
              </div>
              <Badge tone={categoryTone[p.category] ?? "neutral"}>{p.category}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{p.summary}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
