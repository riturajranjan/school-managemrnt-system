"use client";

// HR Policies (Production migration, Phase B, HR Sub-batch 4) — real
// PostgreSQL/API cutover. Only PUBLISHED policies ever reach Employee Self
// Service (see /hr/employee-self-service) — this admin page shows every
// status, including drafts, gated by hr.view/hr.manage. No new permission.
import { useState } from "react";
import { Plus, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { createHrPolicyRequest, setHrPolicyStatusRequest, useHrPolicies } from "@/lib/hooks/api/use-hr-api";
import { roleLabels } from "@/lib/permissions/roles";
import type { HrPolicyDto, HrPolicyStatusDto } from "@/lib/api/contracts";
import { formatDate } from "@/lib/utils";

const statusLabels: Record<HrPolicyStatusDto, string> = { draft: "Draft", published: "Published", archived: "Archived" };
const statusTone: Record<HrPolicyStatusDto, "success" | "warning" | "error" | "neutral" | "info"> = { draft: "neutral", published: "success", archived: "warning" };
const NEXT_STATUS: Record<HrPolicyStatusDto, HrPolicyStatusDto[]> = { draft: ["published", "archived"], published: ["archived"], archived: [] };

export default function PoliciesPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: policies, loading, error, reload } = useHrPolicies();
  const [createOpen, setCreateOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [content, setContent] = useState("");
  const [version, setVersion] = useState("1.0");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  if (!capabilitiesLoading && !hasServerPermission("hr.view") && !hasServerPermission("hr.manage")) {
    return <PermissionDenied action="view policies" role={roleLabels[role]} backHref="/hr" />;
  }
  const canManage = hasServerPermission("hr.manage");

  function resetForm() {
    setTitle(""); setCategory(""); setContent(""); setVersion("1.0"); setEffectiveDate(""); setFormError(null);
  }

  async function submit() {
    setFormError(null);
    if (!title.trim() || !content.trim() || !version.trim()) return setFormError("Title, content, and version are required.");
    const res = await createHrPolicyRequest({ title: title.trim(), category: category.trim() || undefined, content: content.trim(), version: version.trim(), effectiveDate: effectiveDate || undefined });
    if (!res.success) return setFormError(res.error.message);
    resetForm();
    setCreateOpen(false);
    reload();
  }

  async function transition(policy: HrPolicyDto, status: HrPolicyStatusDto) {
    setBusyId(policy.id);
    await setHrPolicyStatusRequest(policy.id, status);
    setBusyId(null);
    reload();
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">HR policies</h1>
          <p className="text-xs text-muted-foreground">Only published policies reach employee self-service</p>
        </div>
        {canManage && <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="size-3.5" /> New policy</Button>}
      </div>

      {error && <div className="rounded-lg border border-error/30 bg-error/5 p-md text-sm text-error" role="alert">Could not load policies: {error}</div>}

      {loading && policies.length === 0 ? (
        <p className="py-2xl text-center text-sm text-muted-foreground">Loading policies…</p>
      ) : policies.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
          <ShieldCheck className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No policies found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
          {policies.map((p) => (
            <div key={p.id} className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
              <div className="flex items-start justify-between gap-sm">
                <div className="flex items-center gap-sm">
                  <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary"><ShieldCheck className="size-4" /></span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{p.title}</p>
                    <p className="text-xs text-muted-foreground">v{p.version}{p.effectiveDate ? ` · effective ${formatDate(p.effectiveDate)}` : ""} · {p.acknowledgedCount} acknowledged</p>
                  </div>
                </div>
                <Badge tone={statusTone[p.status]}>{statusLabels[p.status]}</Badge>
              </div>
              {p.category && <Badge tone="neutral">{p.category}</Badge>}
              <p className="line-clamp-3 text-sm text-muted-foreground">{p.content}</p>
              {canManage && NEXT_STATUS[p.status].length > 0 && (
                <Select value="" onValueChange={(v) => transition(p, v as HrPolicyStatusDto)}>
                  <SelectTrigger className="h-8 w-auto text-xs" disabled={busyId === p.id} aria-label="Change status"><SelectValue placeholder="Change status" /></SelectTrigger>
                  <SelectContent>{NEXT_STATUS[p.status].map((s) => <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>)}</SelectContent>
                </Select>
              )}
            </div>
          ))}
        </div>
      )}

      {canManage && (
        <DetailDrawer open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) resetForm(); }} title="New policy" description="Create a real HR policy">
          <div className="flex flex-col gap-sm">
            <div><Label htmlFor="pol-title">Title</Label><Input id="pol-title" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-sm">
              <div><Label htmlFor="pol-category">Category (optional)</Label><Input id="pol-category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Leave" /></div>
              <div><Label htmlFor="pol-version">Version</Label><Input id="pol-version" value={version} onChange={(e) => setVersion(e.target.value)} /></div>
            </div>
            <div><Label htmlFor="pol-effective">Effective date (optional)</Label><Input id="pol-effective" type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} /></div>
            <div><Label htmlFor="pol-content">Content</Label><Textarea id="pol-content" className="min-h-40" value={content} onChange={(e) => setContent(e.target.value)} /></div>
            {formError && <p className="text-sm text-error">{formError}</p>}
            <Button onClick={submit}>Create policy</Button>
          </div>
        </DetailDrawer>
      )}
    </div>
  );
}
