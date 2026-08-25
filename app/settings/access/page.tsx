"use client";

import { Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useRolesMeta } from "@/lib/hooks/use-admin";
import { accessScopeLabels, type AccessScopeKind } from "@/lib/types/admin";
import { roleLabels } from "@/lib/permissions/roles";

const SCOPES: { kind: AccessScopeKind; desc: string }[] = [
  { kind: "all-schools", desc: "Every school and branch in the organisation." },
  { kind: "selected-school", desc: "One chosen school, all its branches." },
  { kind: "selected-branches", desc: "A specific set of branches." },
  { kind: "own-branch", desc: "Only the user's assigned branch." },
  { kind: "assigned-classes", desc: "Only classes the user teaches/owns." },
  { kind: "assigned-sections", desc: "Only assigned sections." },
  { kind: "assigned-subjects", desc: "Only assigned subjects." },
  { kind: "own-records", desc: "Only the user's own (or their children's) records." },
];

export default function AccessScopesPage() {
  const { role, hasServerPermission } = usePermissions();
  const roles = useRolesMeta();
  const canView = hasServerPermission("settings.view");
  if (!canView) return <PermissionDenied action="view access scopes" role={roleLabels[role]} backHref="/settings" />;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><Lock className="size-5 text-primary" /> Access scopes</h1><p className="text-xs text-muted-foreground">How far each role can see and act</p></div>

      <section>
        <h2 className="mb-sm text-sm font-semibold text-foreground">Scope levels</h2>
        <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
          {SCOPES.map((s) => (
            <div key={s.kind} className="rounded-lg border border-border bg-surface p-sm"><p className="text-sm font-medium text-foreground">{accessScopeLabels[s.kind]}</p><p className="text-xs text-muted-foreground">{s.desc}</p></div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-sm text-sm font-semibold text-foreground">Role scope summary</h2>
        <div className="flex flex-col gap-xs">
          {roles.map((r) => (
            <div key={r.role} className="flex items-center justify-between gap-sm rounded-md border border-border bg-surface p-sm text-sm"><span className="text-foreground">{roleLabels[r.role]}</span><Badge tone="info">{accessScopeLabels[r.scope]}</Badge></div>
          ))}
        </div>
      </section>
      <p className="rounded-md border border-border bg-surface-secondary/40 p-sm text-xs text-muted-foreground">Scope enforcement requires a backend. This screen documents intended access boundaries only.</p>
    </div>
  );
}
