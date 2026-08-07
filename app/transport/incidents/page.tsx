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
import { usePermissions } from "@/components/providers/permissions-provider";
import { useTransportIncidents } from "@/lib/hooks/use-transport";
import { useSisStore } from "@/lib/hooks/use-store";
import { reportIncident, updateIncidentStatus } from "@/lib/services/incident-service";
import { incidentSeverityLabels, incidentStatusLabels, incidentTypeLabels, type IncidentSeverity, type IncidentStatus, type IncidentType, type TransportIncident } from "@/lib/types/transport";
import { formatDateTime } from "@/lib/utils";

const ACTOR = { name: "Transport Manager", role: "Transport Manager" };
const typeOptions = Object.keys(incidentTypeLabels) as IncidentType[];
const severityOptions = Object.keys(incidentSeverityLabels) as IncidentSeverity[];

const severityTone: Record<IncidentSeverity, "success" | "warning" | "error" | "neutral"> = {
  low: "neutral",
  medium: "warning",
  high: "error",
  critical: "error",
};

const statusTone: Record<IncidentStatus, "success" | "warning" | "error" | "neutral"> = {
  open: "error",
  investigating: "warning",
  "action-required": "warning",
  resolved: "success",
  closed: "neutral",
  escalated: "error",
};

export default function IncidentsPage() {
  const incidents = useTransportIncidents();
  const db = useSisStore();
  const { can } = usePermissions();
  const canManage = can("transport.manageIncidents");

  const [detail, setDetail] = useState<TransportIncident | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [resolution, setResolution] = useState("");

  const [type, setType] = useState<IncidentType>("other");
  const [severity, setSeverity] = useState<IncidentSeverity>("medium");
  const [description, setDescription] = useState("");
  const [vehicleId, setVehicleId] = useState("");

  function vehicleName(id?: string) {
    return db.vehicles.find((v) => v.id === id)?.registrationNumber ?? "—";
  }
  function routeName(id?: string) {
    return db.transportRoutes.find((r) => r.id === id)?.name ?? "—";
  }

  const columns: ColumnDef<TransportIncident>[] = [
    {
      id: "number",
      header: "Incident",
      alwaysVisible: true,
      sortValue: (i) => i.incidentNumber,
      cell: (i) => (
        <button type="button" onClick={() => setDetail(i)} className="text-left">
          <p className="text-sm font-medium text-foreground underline-offset-2 hover:underline">{i.incidentNumber}</p>
          <p className="text-xs text-muted-foreground">{incidentTypeLabels[i.type]}</p>
        </button>
      ),
    },
    { id: "vehicle", header: "Vehicle", cell: (i) => <span className="text-sm text-muted-foreground">{vehicleName(i.vehicleId)}</span>, defaultVisible: false },
    { id: "reporter", header: "Reported by", cell: (i) => <span className="text-sm text-muted-foreground">{i.reportedBy}</span> },
    { id: "severity", header: "Severity", cell: (i) => <Badge tone={severityTone[i.severity]}>{incidentSeverityLabels[i.severity]}</Badge> },
    { id: "status", header: "Status", align: "right", cell: (i) => <Badge tone={statusTone[i.status]}>{incidentStatusLabels[i.status]}</Badge> },
  ];

  const rowActions: RowAction<TransportIncident>[] = canManage
    ? [
        { key: "investigate", label: "Start investigating", hidden: (i) => i.status !== "open", onSelect: (i) => updateIncidentStatus(i.id, "investigating", ACTOR) },
        { key: "escalate", label: "Escalate", hidden: (i) => i.status === "closed" || i.status === "resolved", destructive: true, onSelect: (i) => updateIncidentStatus(i.id, "escalated", ACTOR) },
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

      <DataTable
        columns={columns}
        rows={[...incidents].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))}
        getRowId={(i) => i.id}
        caption="Incidents"
        rowActions={rowActions}
        renderMobileCard={(i) => (
          <button type="button" onClick={() => setDetail(i)} className="surface-3d flex w-full flex-col gap-1 rounded-lg border border-border bg-surface p-sm text-left">
            <div className="flex items-center justify-between gap-xs">
              <p className="truncate text-sm font-semibold text-foreground">{i.incidentNumber}</p>
              <Badge tone={statusTone[i.status]}>{incidentStatusLabels[i.status]}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {incidentTypeLabels[i.type]} · {incidentSeverityLabels[i.severity]}
            </p>
          </button>
        )}
        emptyIcon={AlertTriangle}
        emptyTitle="No incidents reported"
      />

      <DetailDrawer open={!!detail} onOpenChange={(open) => !open && setDetail(null)} title={detail?.incidentNumber ?? ""} description={detail ? incidentTypeLabels[detail.type] : undefined}>
        {detail && (
          <div className="flex flex-col gap-sm">
            <div className="flex items-center gap-xs">
              <Badge tone={severityTone[detail.severity]}>{incidentSeverityLabels[detail.severity]}</Badge>
              <Badge tone={statusTone[detail.status]}>{incidentStatusLabels[detail.status]}</Badge>
            </div>
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Occurred</dt>
              <dd className="text-foreground">{formatDateTime(detail.occurredAt)}</dd>
              <dt className="text-muted-foreground">Vehicle</dt>
              <dd className="text-foreground">{vehicleName(detail.vehicleId)}</dd>
              <dt className="text-muted-foreground">Route</dt>
              <dd className="text-foreground">{routeName(detail.routeId)}</dd>
              <dt className="text-muted-foreground">Reported by</dt>
              <dd className="text-foreground">{detail.reportedBy}</dd>
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
              <span>Parent {detail.parentCommunicated ? "notified" : "not yet notified"}</span>
              <span>·</span>
              <span>Authority {detail.authorityCommunicated ? "informed" : "not informed"}</span>
            </div>

            {canManage && detail.status !== "resolved" && detail.status !== "closed" && (
              <div className="flex flex-col gap-xs border-t border-border pt-sm">
                <Label htmlFor="resolution-note">Resolution note</Label>
                <Input id="resolution-note" value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="How was this resolved?" />
                <div className="flex items-center gap-xs">
                  <Button
                    size="sm"
                    disabled={!resolution.trim()}
                    onClick={() => {
                      updateIncidentStatus(detail.id, "resolved", ACTOR, resolution.trim());
                      setDetail(null);
                    }}
                  >
                    Mark resolved
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      updateIncidentStatus(detail.id, "closed", ACTOR, resolution.trim() || undefined);
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
            <Select value={type} onValueChange={(v) => setType(v as IncidentType)}>
              <SelectTrigger aria-label="Incident type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {typeOptions.map((t) => (
                  <SelectItem key={t} value={t}>
                    {incidentTypeLabels[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Severity</Label>
            <Select value={severity} onValueChange={(v) => setSeverity(v as IncidentSeverity)}>
              <SelectTrigger aria-label="Severity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {severityOptions.map((s) => (
                  <SelectItem key={s} value={s}>
                    {incidentSeverityLabels[s]}
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
                {db.vehicles.map((v) => (
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
            disabled={!description.trim()}
            onClick={() => {
              reportIncident({ type, occurredAt: new Date().toISOString(), vehicleId: vehicleId || undefined, reportedBy: ACTOR.name, severity, description: description.trim(), parentCommunicated: false, authorityCommunicated: false }, ACTOR);
              setCreateOpen(false);
              setDescription("");
              setVehicleId("");
            }}
          >
            Report incident
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
