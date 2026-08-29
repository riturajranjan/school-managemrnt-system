"use client";

// Asset detail (Phase 9O; depreciation/disposal added in the production
// migration, Phase A) — real PostgreSQL/API cutover. Disposal is a real
// terminal audit record (lib/server/assets/disposal.ts): reason/date/value/
// recipient/notes, always sets status to RETIRED — the single path to that
// state, replacing the old bare "Retire" status flip (which carried no
// audit trail). Book value is derived live, never stored/posted.
import Link from "next/link";
import { use, useState } from "react";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useStaffList } from "@/lib/hooks/api/use-staff-api";
import {
  assignAssetRequest, completeMaintenanceRequest, disposeAssetRequest, openMaintenanceRequest, returnAssetRequest, setAssetStatusRequest,
  useAsset, useAssetAssignments, useAssetHistory, useAssetMaintenance,
} from "@/lib/hooks/api/use-assets-api";
import { roleLabels } from "@/lib/permissions/roles";
import type { AssetDisposalReasonDto, AssetMaintenanceStatusDto, AssetStatusDto } from "@/lib/api/contracts";
import { formatDate, formatDateTime } from "@/lib/utils";

const statusTone: Record<AssetStatusDto, "success" | "warning" | "error" | "neutral" | "info"> = {
  available: "success", assigned: "info", maintenance: "warning", damaged: "error", lost: "error", retired: "neutral",
};
const statusLabels: Record<AssetStatusDto, string> = {
  available: "Available", assigned: "Assigned", maintenance: "Under maintenance", damaged: "Damaged", lost: "Lost", retired: "Retired",
};
const maintenanceTone: Record<AssetMaintenanceStatusDto, "success" | "warning" | "info" | "neutral"> = {
  open: "warning", "in-progress": "info", completed: "success", cancelled: "neutral",
};
const disposalReasonLabels: Record<AssetDisposalReasonDto, string> = {
  end_of_life: "End of life", damaged: "Damaged beyond repair", sold: "Sold", donated: "Donated",
  lost: "Lost", stolen: "Stolen", replaced: "Replaced", other: "Other",
};

export default function AssetDetailPage({ params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = use(params);
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: asset, loading, reload } = useAsset(assetId);
  const { data: assignments, reload: reloadAssignments } = useAssetAssignments({ assetId });
  const { data: maintenance, reload: reloadMaintenance } = useAssetMaintenance({ assetId });
  const { data: history } = useAssetHistory(assetId);
  const { data: staff } = useStaffList({ status: "active", pageSize: 200 });

  const [assigneeId, setAssigneeId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [disposeOpen, setDisposeOpen] = useState(false);
  const [disposeReason, setDisposeReason] = useState<AssetDisposalReasonDto>("end_of_life");
  const [disposeDate, setDisposeDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [disposeValue, setDisposeValue] = useState("");
  const [disposeRecipient, setDisposeRecipient] = useState("");
  const [disposeNotes, setDisposeNotes] = useState("");
  const [disposeError, setDisposeError] = useState<string | null>(null);

  if (!capabilitiesLoading && !hasServerPermission("assets.view")) return <PermissionDenied action="view assets" role={roleLabels[role]} backHref="/assets" />;
  if (!loading && !asset) {
    return (
      <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
        <p className="text-sm font-medium text-foreground">Asset not found</p>
        <Button asChild size="sm" variant="outline"><Link href="/assets/register">Back to register</Link></Button>
      </div>
    );
  }
  if (!asset) return null;

  const canManage = hasServerPermission("assets.manage");
  const activeAssignment = assignments.find((a) => a.status === "active");
  const currentAssetId = asset.id;

  async function act(fn: () => Promise<{ success: boolean; error?: { message: string } }>) {
    setError(null);
    setBusy(true);
    const r = await fn();
    setBusy(false);
    if (!r.success) setError(r.error?.message ?? "Action failed.");
    else setAssigneeId("");
    reload(); reloadAssignments(); reloadMaintenance();
  }

  async function submitDisposal() {
    setDisposeError(null);
    setBusy(true);
    const res = await disposeAssetRequest(currentAssetId, {
      reason: disposeReason, disposedAt: disposeDate,
      value: disposeValue ? Number(disposeValue) : undefined,
      recipient: disposeRecipient.trim() || undefined,
      notes: disposeNotes.trim() || undefined,
    });
    setBusy(false);
    if (!res.success) return setDisposeError(res.error.message);
    setDisposeOpen(false);
    setDisposeValue(""); setDisposeRecipient(""); setDisposeNotes("");
    reload(); reloadAssignments();
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-sm">
        <Button asChild size="icon" variant="ghost" aria-label="Back"><Link href="/assets/register"><ArrowLeft className="size-4" /></Link></Button>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold text-foreground">{asset.name}</h1>
          <p className="truncate text-xs text-muted-foreground">{asset.assetTag} · {asset.category ?? "Uncategorized"} · {asset.serialNumber ?? "no serial"}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <Metric label="Cost" value={asset.cost !== null ? `₹${asset.cost.toLocaleString("en-IN")}` : "—"} />
        <Metric label="Purchase date" value={asset.purchaseDate ? formatDate(asset.purchaseDate) : "—"} />
        <Metric label="Condition" value={asset.condition} />
        <Metric label="Warranty until" value={asset.warrantyUntil ? formatDate(asset.warrantyUntil) : "—"} />
        {asset.depreciationMethod !== "none" && asset.bookValue !== null && (
          <>
            <Metric label="Book value" value={`₹${asset.bookValue.toLocaleString("en-IN")}`} />
            <Metric label="Accumulated depreciation" value={`₹${asset.accumulatedDepreciation.toLocaleString("en-IN")}`} />
          </>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-xs">
        <Badge tone={statusTone[asset.status]}>{statusLabels[asset.status]}</Badge>
        <Badge tone="neutral">{asset.assignedToName ?? asset.locationName ?? "Unassigned"}</Badge>
      </div>

      {asset.disposal && (
        <div className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm flex items-center gap-1.5 text-sm font-semibold text-foreground"><Trash2 className="size-4" /> Disposal record</h2>
          <p className="text-sm text-foreground">{disposalReasonLabels[asset.disposal.reason]} · {formatDate(asset.disposal.disposedAt)}</p>
          <p className="text-xs text-muted-foreground">
            {asset.disposal.value !== null ? `₹${asset.disposal.value.toLocaleString("en-IN")} recovered · ` : ""}
            {asset.disposal.recipient ? `${asset.disposal.recipient} · ` : ""}
            Recorded by {asset.disposal.createdByName}
            {asset.disposal.approvedByName ? ` · approved by ${asset.disposal.approvedByName}` : ""}
          </p>
          {asset.disposal.notes && <p className="mt-1 text-xs text-muted-foreground">{asset.disposal.notes}</p>}
        </div>
      )}

      {canManage && asset.status !== "retired" && (
        <div className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm text-sm font-semibold text-foreground">Actions</h2>
          <div className="flex flex-col gap-sm sm:flex-row sm:items-end">
            {!activeAssignment && asset.status === "available" && (
              <div className="flex-1">
                <label className="mb-1 block text-xs text-muted-foreground">Assign to</label>
                <Select value={assigneeId} onValueChange={setAssigneeId}>
                  <SelectTrigger aria-label="Assign to"><SelectValue placeholder="Select staff member" /></SelectTrigger>
                  <SelectContent>{staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="flex flex-wrap gap-xs">
              {!activeAssignment && asset.status === "available" && (
                <Button size="sm" variant="outline" disabled={!assigneeId || busy} onClick={() => act(() => assignAssetRequest(asset.id, { staffId: assigneeId }))}>Assign</Button>
              )}
              {activeAssignment && (
                <Button size="sm" variant="outline" disabled={busy} onClick={() => act(() => returnAssetRequest(activeAssignment.id))}>Return</Button>
              )}
              {asset.status === "available" && (
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => act(() => openMaintenanceRequest({ assetId: asset.id, description: "Scheduled maintenance" }))}>Send to maintenance</Button>
              )}
              {(asset.status === "available" || asset.status === "assigned" || asset.status === "maintenance") && (
                <>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => act(() => setAssetStatusRequest(asset.id, { status: "lost" }))}>Mark lost</Button>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => act(() => setAssetStatusRequest(asset.id, { status: "damaged" }))}>Mark damaged</Button>
                </>
              )}
              {(asset.status === "lost" || asset.status === "damaged") && (
                <Button size="sm" variant="outline" disabled={busy} onClick={() => act(() => setAssetStatusRequest(asset.id, { status: "available" }))}>Return to circulation</Button>
              )}
              <Button size="sm" variant="ghost" className="text-error" disabled={busy} onClick={() => setDisposeOpen(true)}>
                <Trash2 className="size-3.5" /> Dispose
              </Button>
            </div>
          </div>
          {error && <p className="mt-sm rounded-md border border-error/30 bg-error/8 p-sm text-sm text-error">{error}</p>}
        </div>
      )}

      <Tabs defaultValue="assignments">
        <TabsList className="flex-wrap">
          <TabsTrigger value="assignments">Assignments ({assignments.length})</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance ({maintenance.length})</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="assignments" className="mt-md">
          {assignments.length === 0 ? (
            <Empty message="This asset has never been assigned." />
          ) : (
            <div className="flex flex-col gap-sm">
              {assignments.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{a.staffName}</p>
                    <p className="text-xs text-muted-foreground">Assigned {formatDate(a.assignedAt)}{a.returnedAt ? ` · returned ${formatDate(a.returnedAt)}` : ""}</p>
                  </div>
                  <Badge tone={a.status === "active" ? "info" : "neutral"}>{a.status === "active" ? "Active" : "Returned"}</Badge>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="maintenance" className="mt-md">
          {maintenance.length === 0 ? (
            <Empty message="No maintenance recorded." />
          ) : (
            <div className="flex flex-col gap-sm">
              {maintenance.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{m.description}</p>
                    <p className="text-xs text-muted-foreground">Opened {formatDate(m.openedAt)}{m.cost !== null ? ` · ₹${m.cost.toLocaleString("en-IN")}` : ""}{m.vendorName ? ` · ${m.vendorName}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-xs">
                    <Badge tone={maintenanceTone[m.status]}>{m.status}</Badge>
                    {canManage && (m.status === "open" || m.status === "in-progress") && (
                      <Button size="sm" variant="ghost" disabled={busy} onClick={() => act(() => completeMaintenanceRequest(m.id))}>Complete</Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-md">
          {!history || history.length === 0 ? (
            <Empty message="No history recorded yet." />
          ) : (
            <ul className="flex flex-col gap-xs">
              {history.map((e) => (
                <li key={e.id} className="surface-3d rounded-lg border border-border bg-surface p-sm">
                  <div className="flex items-center justify-between gap-xs">
                    <span className="text-xs font-medium text-foreground">{e.action.replace(/_/g, " ")}</span>
                    <span className="text-xs text-muted-foreground">{formatDateTime(e.createdAt)}</span>
                  </div>
                  {e.actorName && <p className="mt-1 text-xs text-muted-foreground">{e.actorName}</p>}
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      <DetailDrawer open={disposeOpen} onOpenChange={setDisposeOpen} title="Dispose asset" description={`${asset.name} · this sets its status to Retired`}>
        <div className="flex flex-col gap-sm">
          <div>
            <Label htmlFor="dispose-reason">Reason</Label>
            <Select value={disposeReason} onValueChange={(v) => setDisposeReason(v as AssetDisposalReasonDto)}>
              <SelectTrigger id="dispose-reason"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(disposalReasonLabels) as AssetDisposalReasonDto[]).map((r) => (
                  <SelectItem key={r} value={r}>{disposalReasonLabels[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="dispose-date">Disposal date</Label>
            <Input id="dispose-date" type="date" value={disposeDate} onChange={(e) => setDisposeDate(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="dispose-value">Value recovered (₹, optional)</Label>
            <Input id="dispose-value" type="number" min={0} value={disposeValue} onChange={(e) => setDisposeValue(e.target.value)} placeholder="0" />
          </div>
          <div>
            <Label htmlFor="dispose-recipient">Recipient / buyer (optional)</Label>
            <Input id="dispose-recipient" value={disposeRecipient} onChange={(e) => setDisposeRecipient(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="dispose-notes">Notes (optional)</Label>
            <Input id="dispose-notes" value={disposeNotes} onChange={(e) => setDisposeNotes(e.target.value)} />
          </div>
          {disposeError && <p className="rounded-md border border-error/30 bg-error/8 p-sm text-sm text-error">{disposeError}</p>}
          <Button disabled={busy} className="bg-error hover:bg-error/90" onClick={submitDisposal}>Confirm disposal</Button>
        </div>
      </DetailDrawer>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function Empty({ message }: { message: string }) {
  return <div className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">{message}</div>;
}
