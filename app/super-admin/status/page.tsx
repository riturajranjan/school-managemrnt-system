"use client";

// Real, honest platform status (Super Admin SA-4N). Shows only measurable
// signals: maintenance mode, live database reachability, and manually-recorded
// incidents. Services with no telemetry are listed as "not monitored" — no fake
// uptime or pulse. No mock store.
import { useState } from "react";
import { Server, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/components/providers/permissions-provider";
import {
  createIncidentRequest,
  resolveIncidentRequest,
  updateIncidentRequest,
  usePlatformStatus,
} from "@/lib/hooks/api/use-platform-system";
import { formatDateTime } from "@/lib/utils";
import type { StatusTone } from "@/lib/types/common";

const sevTone: Record<string, StatusTone> = { minor: "info", major: "warning", critical: "error" };
const INCIDENT_STATUSES = ["investigating", "identified", "monitoring", "resolved"] as const;

export default function PlatformStatusPage() {
  const { hasServerPermission } = usePermissions();
  const canManage = hasServerPermission("platform.status.manage");
  const { data, loading, error, reload } = usePlatformStatus();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("minor");
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function create() {
    setBusy("create"); setActionError(null);
    const res = await createIncidentRequest({ title: title.trim(), description: description.trim() || undefined, severity });
    setBusy(null);
    if (!res.success) setActionError(res.error.message);
    else { setTitle(""); setDescription(""); setOpen(false); reload(); }
  }
  async function act(id: string, fn: () => Promise<{ success: boolean; error?: { message: string } }>) {
    setBusy(id); setActionError(null);
    const res = await fn();
    setBusy(null);
    if (!res.success) setActionError(res.error?.message ?? "Failed"); else reload();
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><Server className="size-5 text-primary" /> Platform status</h1><p className="text-xs text-muted-foreground">Real internal signals + manual incidents</p></div>
        {canManage && <Button size="sm" onClick={() => setOpen((o) => !o)}><Plus className="size-3.5" /> Report incident</Button>}
      </div>

      {actionError && <p className="rounded-md border border-error/30 bg-error/10 p-sm text-xs text-error">{actionError}</p>}
      {loading && <div className="py-2xl text-center text-sm text-muted-foreground">Loading status…</div>}
      {error && !loading && <div className="rounded-lg border border-dashed border-error/40 p-md text-center text-sm text-error">Could not load status: {error}</div>}

      {data && !loading && (
        <>
          <div className="grid grid-cols-1 gap-sm sm:grid-cols-3">
            <div className="flex items-center justify-between rounded-lg border border-border bg-surface p-md text-sm"><span className="text-foreground">Database</span><Badge tone={data.databaseReachable ? "success" : "error"}>{data.databaseReachable ? "Reachable" : "Unreachable"}</Badge></div>
            <div className="flex items-center justify-between rounded-lg border border-border bg-surface p-md text-sm"><span className="text-foreground">Maintenance mode</span><Badge tone={data.maintenanceMode ? "warning" : "success"}>{data.maintenanceMode ? "On" : "Off"}</Badge></div>
            <div className="flex items-center justify-between rounded-lg border border-border bg-surface p-md text-sm"><span className="text-foreground">Open incidents</span><Badge tone={data.openIncidentCount > 0 ? "warning" : "success"}>{data.openIncidentCount}</Badge></div>
          </div>
          {data.maintenanceMode && data.maintenanceMessage && <p className="rounded-md border border-warning/30 bg-warning/8 p-sm text-xs text-warning">{data.maintenanceMessage}</p>}

          {open && canManage && (
            <div className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
              <div><Label htmlFor="i-title">Title</Label><Input id="i-title" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
              <div className="grid grid-cols-[1fr_160px] gap-sm">
                <div><Label htmlFor="i-desc">Description</Label><Textarea id="i-desc" rows={2} value={description} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)} /></div>
                <div><Label>Severity</Label><Select value={severity} onValueChange={setSeverity}><SelectTrigger aria-label="Severity"><SelectValue /></SelectTrigger><SelectContent>{["minor", "major", "critical"].map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent></Select></div>
              </div>
              <div className="flex justify-end gap-xs"><Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button size="sm" onClick={() => void create()} disabled={busy === "create" || !title.trim()}>Create incident</Button></div>
            </div>
          )}

          <section>
            <h2 className="mb-sm text-sm font-semibold text-foreground">Active incidents</h2>
            {data.activeIncidents.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No active incidents.</p>
            ) : (
              <div className="flex flex-col gap-xs">
                {data.activeIncidents.map((i) => (
                  <div key={i.id} className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-sm text-sm sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate font-medium text-foreground">{i.title}</p><Badge tone={sevTone[i.severity] ?? "neutral"}>{i.severity}</Badge></div><p className="truncate text-xs text-muted-foreground">Started {formatDateTime(i.startedAt)}{i.description ? ` · ${i.description}` : ""}</p></div>
                    <div className="flex items-center gap-2">
                      {canManage ? (
                        <Select value={i.status} onValueChange={(v) => void act(i.id, () => (v === "resolved" ? resolveIncidentRequest(i.id) : updateIncidentRequest(i.id, { status: v })))}>
                          <SelectTrigger aria-label={`${i.title} status`} className="h-7 w-40 text-xs capitalize" disabled={busy === i.id}><SelectValue /></SelectTrigger>
                          <SelectContent>{INCIDENT_STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                        </Select>
                      ) : <Badge tone="warning">{i.status}</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-sm text-sm font-semibold text-foreground">Not monitored</h2>
            <p className="mb-sm text-xs text-muted-foreground">No live telemetry is connected for these — status is not measured (never faked).</p>
            <div className="flex flex-wrap gap-1">{data.unmonitoredServices.map((s) => <Badge key={s} tone="neutral">{s}</Badge>)}</div>
          </section>
          <p className="text-xs text-muted-foreground">Checked {formatDateTime(data.checkedAt)}</p>
        </>
      )}
    </div>
  );
}
