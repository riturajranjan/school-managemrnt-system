"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Blocks } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useModules } from "@/lib/hooks/use-admin";
import { moveModule, setModuleVisibility, toggleModule } from "@/lib/services/admin-service";
import { roleLabels } from "@/lib/permissions/roles";
import type { ModuleSetting } from "@/lib/types/admin";

export default function ModulesPage() {
  const { role } = usePermissions();
  const modules = useModules();
  const [, force] = useState(0);
  const sorted = useMemo(() => [...modules].sort((a, b) => a.order - b.order), [modules]);

  const canManage = role === "super-admin" || role === "administrator";
  if (!canManage) return <PermissionDenied action="manage modules" role={roleLabels[role]} backHref="/settings" />;
  const bump = () => force((n) => n + 1);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><Blocks className="size-5 text-primary" /> Module management</h1><p className="text-xs text-muted-foreground">Enable, reorder and scope modules (simulation — routes are not removed)</p></div>

      <div className="flex flex-col gap-xs">
        {sorted.map((m, i) => (
          <div key={m.id} className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2"><span className="text-xs tabular-nums text-muted-foreground">{i + 1}</span><span className="text-sm font-medium text-foreground">{m.label}</span>{!m.branchAvailable && <Badge tone="warning">Branch-limited</Badge>}</div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={m.roleVisibility} onValueChange={(v) => { setModuleVisibility(m.id, v as ModuleSetting["roleVisibility"]); bump(); }}>
                <SelectTrigger aria-label="Visibility" className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="everyone">Everyone</SelectItem><SelectItem value="staff">Staff only</SelectItem><SelectItem value="admin">Admin only</SelectItem></SelectContent>
              </Select>
              <Button size="sm" variant="ghost" onClick={() => { moveModule(m.id, -1); bump(); }} aria-label="Move up"><ArrowUp className="size-3.5" /></Button>
              <Button size="sm" variant="ghost" onClick={() => { moveModule(m.id, 1); bump(); }} aria-label="Move down"><ArrowDown className="size-3.5" /></Button>
              <label className="flex items-center gap-1 text-xs text-muted-foreground"><input type="checkbox" checked={m.enabled} onChange={() => { toggleModule(m.id); bump(); }} aria-label={`Toggle ${m.label}`} /> {m.enabled ? "Enabled" : "Disabled"}</label>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
