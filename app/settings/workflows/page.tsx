"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2, Workflow } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useWorkflows } from "@/lib/hooks/use-admin";
import { addWorkflowStep, moveWorkflowStep, removeWorkflowStep, updateWorkflowStep } from "@/lib/services/admin-service";
import { allRoles, roleLabels, type UserRole } from "@/lib/permissions/roles";

export default function WorkflowsPage() {
  const { role } = usePermissions();
  const workflows = useWorkflows();
  const [, force] = useState(0);
  const [openId, setOpenId] = useState<string | null>(workflows[0]?.id ?? null);

  const canManage = role === "super-admin" || role === "administrator" || role === "principal";
  if (!canManage) return <PermissionDenied action="manage workflows" role={roleLabels[role]} backHref="/settings" />;
  const wf = workflows.find((w) => w.id === openId);
  const bump = () => force((n) => n + 1);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><Workflow className="size-5 text-primary" /> Approval workflows</h1><p className="text-xs text-muted-foreground">{workflows.length} workflows · step editor (no backend engine)</p></div>

      <div className="grid grid-cols-1 gap-md lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="flex flex-col gap-xs">
          {workflows.map((w) => (
            <button key={w.id} type="button" onClick={() => setOpenId(w.id)} className={`flex items-center justify-between gap-2 rounded-lg border p-sm text-left text-sm transition ${openId === w.id ? "border-primary bg-primary/5" : "border-border bg-surface hover:border-primary/40"}`}>
              <div className="min-w-0"><p className="truncate font-medium text-foreground">{w.name}</p><p className="truncate text-xs text-muted-foreground">{w.module} · {w.steps.length} steps</p></div>
              <Badge tone={w.status === "active" ? "success" : "neutral"}>{w.status}</Badge>
            </button>
          ))}
        </div>

        {wf && (
          <div className="flex flex-col gap-md">
            <div><p className="text-sm font-semibold text-foreground">{wf.name}</p><p className="text-xs text-muted-foreground">{wf.description}</p></div>

            {/* Connected node visual */}
            <div className="overflow-x-auto">
              <div className="flex min-w-max items-center gap-1 p-1">
                {["Request", ...wf.steps.map((s) => s.label), "Complete"].map((label, i, arr) => (
                  <div key={i} className="flex items-center gap-1">
                    <div className={`flex w-24 flex-col items-center gap-1 rounded-lg border p-2 text-center ${i === 0 || i === arr.length - 1 ? "border-border bg-surface-secondary/40" : "border-primary/40 bg-primary/5"}`}>
                      <span className="text-[11px] font-medium leading-tight text-foreground">{label}</span>
                    </div>
                    {i < arr.length - 1 && <svg width="16" height="20" viewBox="0 0 16 20" className="shrink-0 text-border" aria-hidden><path d="M1 10 H10" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" /><path d="M9 6 L13 10 L9 14" stroke="currentColor" strokeWidth="2" fill="none" /></svg>}
                  </div>
                ))}
              </div>
            </div>

            {/* Step editor */}
            <div className="flex flex-col gap-xs">
              {[...wf.steps].sort((a, b) => a.order - b.order).map((s, i) => (
                <div key={s.id} className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-sm sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2"><span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
                    <Select value={s.role} onValueChange={(v) => { updateWorkflowStep(wf.id, s.id, { role: v as UserRole, label: `${roleLabels[v as UserRole]} approves` }); bump(); }}>
                      <SelectTrigger aria-label="Step role" className="h-7 w-48 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{allRoles.map((r) => <SelectItem key={r} value={r}>{roleLabels[r]}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 text-xs text-muted-foreground"><input type="checkbox" checked={s.required} onChange={(e) => { updateWorkflowStep(wf.id, s.id, { required: e.target.checked }); bump(); }} /> Required</label>
                    <Button size="sm" variant="ghost" onClick={() => { moveWorkflowStep(wf.id, s.id, -1); bump(); }} aria-label="Move up"><ArrowUp className="size-3.5" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => { moveWorkflowStep(wf.id, s.id, 1); bump(); }} aria-label="Move down"><ArrowDown className="size-3.5" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => { removeWorkflowStep(wf.id, s.id); bump(); }} aria-label="Remove step"><Trash2 className="size-3.5" /></Button>
                  </div>
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={() => { addWorkflowStep(wf.id, "principal", "Principal approves"); bump(); }}><Plus className="size-3.5" /> Add step</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
