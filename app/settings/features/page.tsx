"use client";

import { useState } from "react";
import { FlaskConical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useFeatureFlags } from "@/lib/hooks/use-admin";
import { setFeatureState } from "@/lib/services/admin-service";
import { roleLabels } from "@/lib/permissions/roles";
import { featureStateLabels, featureStateTone, type FeatureState } from "@/lib/types/admin";

export default function FeaturesPage() {
  const { role } = usePermissions();
  const features = useFeatureFlags();
  const [, force] = useState(0);

  const canManage = role === "super-admin" || role === "administrator";
  if (!canManage) return <PermissionDenied action="manage features" role={roleLabels[role]} backHref="/settings" />;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><FlaskConical className="size-5 text-primary" /> Feature flags</h1><p className="text-xs text-muted-foreground">Toggle optional capabilities</p></div>

      <div className="flex flex-col gap-xs">
        {features.map((f) => (
          <div key={f.id} className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0"><div className="flex items-center gap-2"><p className="text-sm font-medium text-foreground">{f.label}</p><Badge tone={featureStateTone[f.state]}>{featureStateLabels[f.state]}</Badge></div><p className="text-xs text-muted-foreground">{f.description}</p></div>
            <Select value={f.state} onValueChange={(v) => { setFeatureState(f.id, v as FeatureState); force((n) => n + 1); }}>
              <SelectTrigger aria-label={`${f.label} state`} className="h-7 w-36 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{(Object.keys(featureStateLabels) as FeatureState[]).map((s) => <SelectItem key={s} value={s}>{featureStateLabels[s]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        ))}
      </div>
    </div>
  );
}
