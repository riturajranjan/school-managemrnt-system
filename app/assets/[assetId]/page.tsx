"use client";

import Link from "next/link";
import { use, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResourceAuditTrail } from "@/components/library/resource-audit-trail";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { assignAsset, completeMaintenance, disposeAsset, returnAsset, runDepreciation, scheduleMaintenance } from "@/lib/services/asset-service";
import { currentBookValue } from "@/lib/selectors/asset-depreciation";
import { roleLabels } from "@/lib/permissions/roles";
import { assetMaintenanceStatusLabels, assetStatusLabels, assignmentStatusLabels, depreciationMethodLabels, maintenanceTypeLabels, type AssetStatus } from "@/lib/types/assets";
import { formatMoney } from "@/lib/finance/money";
import { formatDate } from "@/lib/utils";

const statusTone: Record<AssetStatus, "success" | "warning" | "error" | "neutral" | "info"> = {
  available: "success",
  assigned: "info",
  "in-use": "info",
  maintenance: "warning",
  damaged: "error",
  lost: "error",
  retired: "neutral",
  disposed: "neutral",
};

export default function AssetDetailPage({ params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = use(params);
  const db = useSisStore();
  const { can, role } = usePermissions();
  const actor = { name: "Asset Manager", role: roleLabels[role] };
  const [assignee, setAssignee] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [, force] = useState(0);

  const asset = db.assets.find((a) => a.id === assetId);
  if (!can("assets.view")) return <PermissionDenied action="view assets" role={roleLabels[role]} backHref="/assets" />;
  if (!asset) {
    return (
      <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
        <p className="text-sm font-medium text-foreground">Asset not found</p>
        <Button asChild size="sm" variant="outline"><Link href="/assets/register">Back to register</Link></Button>
      </div>
    );
  }

  const assignments = db.assetAssignments.filter((a) => a.assetId === asset.id);
  const activeAssignment = assignments.find((a) => a.status === "active");
  const maintenance = db.assetMaintenance.filter((m) => m.assetId === asset.id);
  const category = db.assetCategories.find((c) => c.id === asset.categoryId)?.name ?? "—";
  const canManage = can("assets.manageRegister") || can("assets.assign");

  function act(fn: () => { ok: boolean; error?: string }) {
    setError(null);
    const r = fn();
    if (!r.ok) setError(r.error ?? "Action failed.");
    else setAssignee("");
    force((x) => x + 1);
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-sm">
        <Button asChild size="icon" variant="ghost" aria-label="Back"><Link href="/assets/register"><ArrowLeft className="size-4" /></Link></Button>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold text-foreground">{asset.name}</h1>
          <p className="truncate text-xs text-muted-foreground">{asset.assetTag} · {category} · {asset.serialNumber ?? "no serial"}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <Metric label="Cost" value={formatMoney(asset.cost)} />
        <Metric label="Book value" value={formatMoney(currentBookValue(asset))} />
        <Metric label="Depreciation" value={depreciationMethodLabels[asset.depreciationMethod]} />
        <Metric label="Condition" value={asset.condition} />
      </div>
      <div className="flex flex-wrap items-center gap-xs">
        <Badge tone={statusTone[asset.status]}>{assetStatusLabels[asset.status]}</Badge>
        <Badge tone="neutral">{asset.assignedToName ?? asset.location}</Badge>
        {asset.warrantyExpiry && <Badge tone="info">Warranty {formatDate(asset.warrantyExpiry)}</Badge>}
      </div>

      {canManage && asset.status !== "disposed" && (
        <div className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm text-sm font-semibold text-foreground">Actions</h2>
          <div className="flex flex-col gap-sm sm:flex-row sm:items-end">
            {!activeAssignment && can("assets.assign") && (
              <div className="flex-1">
                <label className="mb-1 block text-xs text-muted-foreground">Assign to</label>
                <Input value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="Teacher / department / room" aria-label="Assign to" />
              </div>
            )}
            <div className="flex flex-wrap gap-xs">
              {!activeAssignment && can("assets.assign") && <Button size="sm" variant="outline" disabled={!assignee.trim()} onClick={() => act(() => assignAsset({ assetId: asset.id, targetType: "teacher", targetName: assignee.trim() }, actor))}>Assign</Button>}
              {activeAssignment && can("assets.assign") && <Button size="sm" variant="outline" onClick={() => act(() => returnAsset(activeAssignment.id, actor, "good"))}>Return</Button>}
              {can("assets.manageMaintenance") && <Button size="sm" variant="ghost" onClick={() => act(() => scheduleMaintenance({ assetId: asset.id, type: "preventive", scheduledDate: new Date().toISOString().slice(0, 10) }, actor))}>Schedule maintenance</Button>}
              {can("assets.runDepreciation") && <Button size="sm" variant="ghost" onClick={() => act(() => runDepreciation(asset.id, actor))}>Run depreciation</Button>}
              {can("assets.dispose") && <Button size="sm" variant="ghost" onClick={() => act(() => disposeAsset({ assetId: asset.id, reason: "end-of-life", approvedBy: can("assets.approveDisposal") ? actor.name : undefined }, actor))}>Dispose</Button>}
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
                    <p className="truncate text-sm font-medium text-foreground">{a.targetName}</p>
                    <p className="text-xs text-muted-foreground">Assigned {formatDate(a.assignedAt)}{a.returnedAt ? ` · returned ${formatDate(a.returnedAt)}` : ""}</p>
                  </div>
                  <Badge tone={a.status === "active" ? "info" : "neutral"}>{assignmentStatusLabels[a.status]}</Badge>
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
                    <p className="text-sm font-medium text-foreground">{maintenanceTypeLabels[m.type]}</p>
                    <p className="text-xs text-muted-foreground">Scheduled {formatDate(m.scheduledDate)}{m.cost ? ` · ${formatMoney(m.cost)}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-xs">
                    <Badge tone={m.status === "completed" ? "success" : m.status === "overdue" ? "error" : "warning"}>{assetMaintenanceStatusLabels[m.status]}</Badge>
                    {can("assets.manageMaintenance") && m.status !== "completed" && (
                      <Button size="sm" variant="ghost" onClick={() => { completeMaintenance(m.id, actor, {}); force((n) => n + 1); }}>Complete</Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-md">
          <ResourceAuditTrail domain="asset" subjectId={asset.id} />
        </TabsContent>
      </Tabs>
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
