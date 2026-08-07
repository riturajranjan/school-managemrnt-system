"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, FileStack, Pause, Play, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { retryBatchFailures, setBatchStatus } from "@/lib/services/documents-service";
import { roleLabels } from "@/lib/permissions/roles";
import { batchStatusLabels, batchStatusTone, documentTypeLabels } from "@/lib/types/documents";
import { formatDateTime } from "@/lib/utils";

export default function BatchGenerationPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [, force] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const batches = useMemo(() => [...db.documentBatches].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [db.documentBatches]);
  const items = useMemo(() => (openId ? db.documentBatchItems.filter((i) => i.batchId === openId) : []), [db.documentBatchItems, openId]);

  if (!can("documents.view")) return <PermissionDenied action="view batch generation" role={roleLabels[role]} backHref="/documents" />;
  const canRun = can("documents.batch");

  const act = (fn: () => { ok: boolean; error?: string }) => { const r = fn(); if (!r.ok) setError(r.error ?? "Action failed."); else setError(null); force((n) => n + 1); };

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><FileStack className="size-5 text-primary" /> Batch generation</h1><p className="text-xs text-muted-foreground">{batches.length} batch jobs · frontend simulation</p></div>

      {error && <p className="rounded-md border border-error/30 bg-error/8 p-sm text-xs text-error">{error}</p>}

      <div className="flex flex-col gap-sm">
        {batches.map((b) => {
          const pct = b.total > 0 ? Math.round((b.ready / b.total) * 100) : 0;
          const open = openId === b.id;
          return (
            <div key={b.id} className="rounded-lg border border-border bg-surface p-md">
              <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2"><p className="truncate text-sm font-semibold text-foreground">{b.name}</p><Badge tone={batchStatusTone[b.status]}>{batchStatusLabels[b.status]}</Badge></div>
                  <p className="truncate text-xs text-muted-foreground">{documentTypeLabels[b.docType]} · {b.groupLabel} · {formatDateTime(b.createdAt)}</p>
                </div>
                <div className="flex flex-wrap gap-xs">
                  <Button size="sm" variant="ghost" onClick={() => setOpenId(open ? null : b.id)}>{open ? "Hide" : "Readiness"}</Button>
                  {canRun && (b.status === "ready" || b.status === "paused") && <Button size="sm" onClick={() => act(() => setBatchStatus(b.id, "running"))}><Play className="size-3.5" /> Start</Button>}
                  {canRun && b.status === "running" && <Button size="sm" variant="outline" onClick={() => act(() => setBatchStatus(b.id, "paused"))}><Pause className="size-3.5" /> Pause</Button>}
                  {canRun && b.failed > 0 && <Button size="sm" variant="outline" onClick={() => act(() => retryBatchFailures(b.id))}><RotateCcw className="size-3.5" /> Retry failed</Button>}
                </div>
              </div>

              {/* Readiness */}
              <div className="mt-sm grid grid-cols-2 gap-sm sm:grid-cols-5">
                <Metric label="Total" value={b.total} tone="neutral" />
                <Metric label="Ready" value={b.ready} tone="success" />
                <Metric label="Missing info" value={b.missing} tone={b.missing > 0 ? "warning" : "neutral"} />
                <Metric label="Failed" value={b.failed} tone={b.failed > 0 ? "error" : "neutral"} />
                <Metric label="Est. pages" value={b.estimatedPages} tone="neutral" />
              </div>
              <div className="mt-sm h-2 w-full overflow-hidden rounded-pill bg-surface-secondary"><div className="h-full rounded-pill bg-success" style={{ width: `${pct}%` }} /></div>
              {(b.missing > 0 || b.failed > 0) && <p className="mt-1 flex items-center gap-1 text-xs text-warning"><AlertTriangle className="size-3.5" /> {b.missing + b.failed} record(s) need attention before this batch can complete.</p>}

              {open && (
                <div className="mt-sm rounded-md border border-border">
                  <p className="border-b border-border px-sm py-1.5 text-xs font-medium text-muted-foreground">Records — preview first {Math.min(3, items.length)} + issues</p>
                  <div className="max-h-64 overflow-y-auto">
                    {[...items].sort((a, b2) => (a.status === "ready" ? 1 : -1) - (b2.status === "ready" ? 1 : -1)).slice(0, 30).map((it) => (
                      <div key={it.id} className="flex items-center justify-between gap-sm border-b border-border/60 px-sm py-1.5 text-sm last:border-0">
                        <div className="min-w-0"><p className="truncate text-foreground">{it.recipientName}</p><p className="truncate text-xs text-muted-foreground">{it.recipientSubtitle}{it.issue ? ` · ${it.issue}` : ""}</p></div>
                        <Badge tone={it.status === "ready" || it.status === "generated" ? "success" : it.status === "missing-info" ? "warning" : "error"}>{it.status === "missing-info" ? "Missing" : it.status}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: "neutral" | "success" | "warning" | "error" }) {
  const toneText = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : tone === "error" ? "text-error" : "text-foreground";
  return <div className="rounded-md border border-border p-sm text-center"><p className={`text-lg font-bold tabular-nums ${toneText}`}>{value}</p><p className="text-[10px] text-muted-foreground">{label}</p></div>;
}
