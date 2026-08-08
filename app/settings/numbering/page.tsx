"use client";

import { useState } from "react";
import { Hash } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useNumberingRules } from "@/lib/hooks/use-admin";
import { updateNumberingRule } from "@/lib/services/admin-service";
import { roleLabels } from "@/lib/permissions/roles";
import type { NumberingRule } from "@/lib/types/admin";

function preview(r: NumberingRule): string {
  const parts = [r.prefix];
  if (r.includeBranch) parts.push("MC");
  if (r.includeYear) parts.push("2026");
  if (r.includeSession) parts.push("26-27");
  parts.push(String(r.nextSequence).padStart(r.sequenceLength, "0"));
  return parts.join(r.separator);
}

export default function NumberingPage() {
  const { role } = usePermissions();
  const rules = useNumberingRules();
  const [, force] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);

  const canManage = role === "super-admin" || role === "administrator";
  if (!canManage) return <PermissionDenied action="manage numbering rules" role={roleLabels[role]} backHref="/settings" />;
  const bump = () => force((n) => n + 1);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><Hash className="size-5 text-primary" /> Numbering rules</h1><p className="text-xs text-muted-foreground">{rules.length} entities · frontend preview only</p></div>

      <div className="flex flex-col gap-xs">
        {rules.map((r) => {
          const open = openId === r.id;
          return (
            <div key={r.id} className="rounded-lg border border-border bg-surface p-sm">
              <button type="button" onClick={() => setOpenId(open ? null : r.id)} className="flex w-full items-center justify-between gap-sm text-left">
                <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{r.name}</p><p className="truncate text-xs text-muted-foreground">{r.entity}</p></div>
                <Badge tone="info">{preview(r)}</Badge>
              </button>
              {open && (
                <div className="mt-sm grid grid-cols-2 gap-sm border-t border-border pt-sm sm:grid-cols-3">
                  <div><Label htmlFor={`p-${r.id}`}>Prefix</Label><Input id={`p-${r.id}`} value={r.prefix} onChange={(e) => { updateNumberingRule(r.id, { prefix: e.target.value }); bump(); }} /></div>
                  <div><Label htmlFor={`s-${r.id}`}>Sequence length</Label><Input id={`s-${r.id}`} type="number" min={1} value={r.sequenceLength} onChange={(e) => { updateNumberingRule(r.id, { sequenceLength: Number(e.target.value) }); bump(); }} /></div>
                  <div><Label htmlFor={`sep-${r.id}`}>Separator</Label><Input id={`sep-${r.id}`} value={r.separator} maxLength={1} onChange={(e) => { const v = e.target.value as NumberingRule["separator"]; if (v === "/" || v === "-" || v === ".") { updateNumberingRule(r.id, { separator: v }); bump(); } }} /></div>
                  <label className="flex items-center gap-1 text-xs text-muted-foreground"><input type="checkbox" checked={r.includeYear} onChange={() => { updateNumberingRule(r.id, { includeYear: !r.includeYear }); bump(); }} /> Include year</label>
                  <label className="flex items-center gap-1 text-xs text-muted-foreground"><input type="checkbox" checked={r.includeBranch} onChange={() => { updateNumberingRule(r.id, { includeBranch: !r.includeBranch }); bump(); }} /> Include branch</label>
                  <label className="flex items-center gap-1 text-xs text-muted-foreground"><input type="checkbox" checked={r.includeSession} onChange={() => { updateNumberingRule(r.id, { includeSession: !r.includeSession }); bump(); }} /> Include session</label>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
