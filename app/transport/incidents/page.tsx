"use client";

import { useState } from "react";
import { AlertTriangle, Plus } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef, RowAction } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/input";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useTransportIncidents, useTransportVehicles, reportIncidentRequest, updateIncidentStatusRequest } from "@/lib/hooks/api/use-transport-api";
import { roleLabels } from "@/lib/permissions/roles";
import type { TransportIncidentDto, TransportIncidentSeverityDto, TransportIncidentStatusDto, TransportIncidentTypeDto } from "@/lib/api/contracts";
import { formatDateTime } from "@/lib/utils";

const typeLabels: Record<TransportIncidentTypeDto, string> = { breakdown: "Breakdown", accident: "Accident", delay: "Delay", "safety-concern": "Safety concern", behaviour: "Behaviour", other: "Other" };
const severityLabels: Record<TransportIncidentSeverityDto, string> = { low: "Low", medium: "Medium", high: "High", critical: "Critical" };
const statusLabels: Record<TransportIncidentStatusDto, string> = { open: "Open", investigating: "Investigating", resolved: "Resolved", closed: "Closed" };
const typeOptions = Object.keys(typeLabels) as TransportIncidentTypeDto[];
const severityOptions = Object.keys(severityLabels) as TransportIncidentSeverityDto[];

const severityTone: Record<TransportIncidentSeverityDto, "success" | "warning" | "error" | "neutral"> = { low: "neutral", medium: "warning", high: "error", critical: "error" };
const statusTone: Record<TransportIncidentStatusDto, "success" | "warning" | "error" | "neutral"> = { open: "error", investigating: "warning", resolved: "success", closed: "neutral" };

export default function IncidentsPage() {
  const { data, loading, error, reload } = useTransportIncidents();
  const { data: vehicles } = useTransportVehicles();
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const incidents = data?.incidents ?? [];

  const [detail, setDetail] = useState<TransportIncidentDto | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [resolution, setResolution] = useState("");
  const [busy, setBusy] = useState(false);

  const [type, setType] = useState<TransportIncidentTypeDto>("other");
  const [severity, setSeverity] = useState<TransportIncidentSeverityDto>("medium");
  const [description, setDescription] = useState("");
  const [vehicleId, setVehicleId] = useState("");

  if (!capabilitiesLoading && !hasServerPermission("transport.view")) {
    return <PermissionDenied action="view transport incidents" role={roleLabels[role]} backHref="/transport" />;
  }
  const canManage = hasServerPermission("transport.manage");

  async function changeStatus(id: string, status: "investigating" | "resolved" | "closed", res?: string) {
    setBusy(true);
    const result = await updateIncidentStatusRequest(id, { status, resolution: res });
    setBusy(false);
    if (result.success) reload();
  }

  const columns: ColumnDef<TransportIncidentDto>[] = [
    {
      id: "incident",
      header: "Incident",
      alwaysVisible: true,
      sortValue: (i) => i.occurredAt,
      cell: (i) => (
        <button type="button" onClick={() => setDetail(i)} className="text-left">
          <p className="text-sm font-medium text-foreground underline-offset-2 hover:underline">{formatDateTime(i.occurredAt)}</p>
          <p className="text-xs text-muted-foreground">{typeLabels[i.type]}</p>
        </button>
      ),
    },
    { id: "vehicle", header: "Vehicle", cell: (i) => <span className="text-sm text-muted-foreground">{i.vehicleRegistration ?? "—"}</span>, defaultVisible: false },
    { id: "reporter", header: "Reported by", cell: (i) => <span className="text-sm text-muted-foreground">{i.reportedByName}</span> },
    { id: "severity", header: "Severity", cell: (i) => <Badge tone={severityTone[i.severity]}>{severityLabels[i.severity]}</Badge> },
    { id: "status", header: "Status", align: "right", cell: (i) => <Badge tone={statusTone[i.status]}>{statusLabels[i.status]}</Badge> },
  ];

  const rowActions: RowAction<TransportIncidentDto>[] = canManage
    ? [
        { key: "investigate", label: "Start investigating", hidden: (i) => i.status !== "open", onSelect: (i) => void changeStatus(i.id, "investigating") },
        {
          key: "resolve",
          label: "Resolve",
          hidden: (i) => i.status === "resolved" || i.status === "closed",
          onSelect: (i) => {
            setDetail(i);
            setResolution("");
          },
        },
      ]
    : [];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Incidents</h1>
          <p className="text-xs text-muted-foreground">Report and track transport incidents</p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" />
            Report incident
          </Button>
        )}
      </div>

      {error ? (
        <div className="rounded-lg border border-error/30 bg-error/5 p-md text-sm text-error" role="alert">
          Could not load incidents: {error}
          <Button variant="outline" size="sm" className="ml-sm" onClick={reload}>
            Retry
          </Button>
        </div>
      ) : loading && incidents.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-2xl text-center text-sm text-muted-foreground">Loading incidents…</div>
      ) : (
        <DataTable
          columns={columns}
          rows={incidents}
          getRowId={(i) => i.id}
          caption="Incidents"
          rowActions={rowActions}
          renderMobileCard={(i) => (
            <button type="button" onClick={() => setDetail(i)} className="surface-3d flex w-full flex-col gap-1 rounded-lg border border-border bg-surface p-sm text-left">
              <div className="flex items-center justify-between gap-xs">
                <p className="truncate text-sm font-semibold text-foreground">{formatDateTime(i.occurredAt)}</p>
                <Badge tone={statusTone[i.status]}>{statusLabels[i.status]}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {typeLabels[i.type]} · {severityLabels[i.severity]}
              </p>
            </button>
          )}
          emptyIcon={AlertTriangle}
          emptyTitle="No incidents reported"
        />
      )}

      <DetailDrawer open={!!detail} onOpenChange={(open) => !open && setDetail(null)} title={detail ? typeLabels[detail.type] : ""} description={detail ? formatDateTime(detail.occurredAt) : undefined}>
        {detail && (
          <div className="flex flex-col gap-sm">
            <div className="flex items-center gap-xs">
              <Badge tone={severityTone[detail.severity]}>{severityLabels[detail.severity]}</Badge>
              <Badge tone={statusTone[detail.status]}>{statusLabels[detail.status]}</Badge>
            </div>
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Occurred</dt>
              <dd className="text-foreground">{formatDateTime(detail.occurredAt)}</dd>
              <dt className="text-muted-foreground">Vehicle</dt>
              <dd className="text-foreground">{detail.vehicleRegistration ?? "—"}</dd>
              <dt className="text-muted-foreground">Route</dt>
              <dd className="text-foreground">{detail.routeName ?? "—"}</dd>
              <dt className="text-muted-foreground">Reported by</dt>
              <dd className="text-foreground">{detail.reportedByName}</dd>
              <dt className="text-muted-foreground">Location</dt>
              <dd className="text-foreground">{detail.location ?? "—"}</dd>
            </dl>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Description</p>
              <p className="text-sm text-foreground">{detail.description}</p>
            </div>
            {detail.immediateAction && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">Immediate action</p>
                <p className="text-sm text-foreground">{detail.immediateAction}</p>
              </div>
            )}
            {detail.resolution && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">Resolution</p>
                <p className="text-sm text-foreground">{detail.resolution}</p>
              </div>
            )}
            <div className="flex items-center gap-xs text-xs text-muted-foreground">
              <span>Parent {detail.parentNotified ? "notified" : "not yet notified"}</span>
              <span>·</span>
              <span>Authority {detail.authorityNotified ? "informed" : "not informed"}</span>
            </div>

            {canManage && detail.status !== "resolved" && detail.status !== "closed" && (
              <div className="flex flex-col gap-xs border-t border-border pt-sm">
                <Label htmlFor="resolution-note">Resolution note</Label>
                <Input id="resolution-note" value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="How was this resolved?" />
                <div className="flex items-center gap-xs">
                  <Button
                    size="sm"
                    disabled={!resolution.trim() || busy}
                    onClick={async () => {
                      await changeStatus(detail.id, "resolved", resolution.trim());
                      setDetail(null);
                    }}
                  >
                    Mark resolved
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={async () => {
                      await changeStatus(detail.id, "closed", resolution.trim() || undefined);
                      setDetail(null);
                    }}
                  >
                    Close
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DetailDrawer>

      <DetailDrawer open={createOpen} onOpenChange={setCreateOpen} title="Report incident" description="Creates an open incident record">
        <div className="flex flex-col gap-sm">
          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as TransportIncidentTypeDto)}>
              <SelectTrigger aria-label="Incident type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {typeOptions.map((t) => (
                  <SelectItem key={t} value={t}>
                    {typeLabels[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Severity</Label>
            <Select value={severity} onValueChange={(v) => setSeverity(v as TransportIncidentSeverityDto)}>
              <SelectTrigger aria-label="Severity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {severityOptions.map((s) => (
                  <SelectItem key={s} value={s}>
                    {severityLabels[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Vehicle (optional)</Label>
            <Select value={vehicleId} onValueChange={setVehicleId}>
              <SelectTrigger aria-label="Vehicle">
                <SelectValue placeholder="Not vehicle-specific" />
              </SelectTrigger>
              <SelectContent>
                {(vehicles ?? []).map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.registrationNumber}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="incident-desc">Description</Label>
            <Textarea id="incident-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <Button
            disabled={!description.trim() || busy}
            onClick={async () => {
              setBusy(true);
              const result = await reportIncidentRequest({ type, severity, vehicleId: vehicleId || undefined, description: description.trim() });
              setBusy(false);
              if (result.success) {
                setCreateOpen(false);
                setDescription("");
                setVehicleId("");
                reload();
              }
            }}
          >
            Report incident
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
