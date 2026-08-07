"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AlertTriangle, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/input";
import { OfflineBanner } from "@/components/transport/offline-banner";
import { useCurrentDriver } from "@/lib/hooks/use-transport";
import { useSisStore } from "@/lib/hooks/use-store";
import { trackPendingSync, useIsOnline, usePendingSync } from "@/lib/offline/offline-status";
import { reportIncident } from "@/lib/services/incident-service";
import { incidentSeverityLabels, incidentStatusLabels, incidentTypeLabels, type IncidentSeverity, type IncidentStatus, type IncidentType } from "@/lib/types/transport";
import { formatDate } from "@/lib/utils";

const typeOptions = Object.keys(incidentTypeLabels) as IncidentType[];
const severityOptions = Object.keys(incidentSeverityLabels) as IncidentSeverity[];

const statusTone: Record<IncidentStatus, "success" | "warning" | "error" | "neutral"> = {
  open: "error",
  investigating: "warning",
  "action-required": "warning",
  resolved: "success",
  closed: "neutral",
  escalated: "error",
};

function DriverIncidentsContent() {
  const searchParams = useSearchParams();
  const tripId = searchParams.get("tripId") ?? undefined;
  const driver = useCurrentDriver();
  const db = useSisStore();
  const online = useIsOnline();
  const pending = usePendingSync();

  const [reportOpen, setReportOpen] = useState(false);
  const [type, setType] = useState<IncidentType>("vehicle-damage");
  const [severity, setSeverity] = useState<IncidentSeverity>("medium");
  const [description, setDescription] = useState("");

  if (!driver) return null;

  const myIncidents = db.transportIncidents.filter((i) => i.reportedBy === driver.name).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const trip = tripId ? db.transportTrips.find((t) => t.id === tripId) : undefined;

  return (
    <div className="mx-auto flex w-full  flex-col gap-md pb-24 sm:pb-0">
      <div className="flex items-center justify-between gap-xs">
        <h1 className="text-lg font-semibold text-foreground">My reports</h1>
        <Button size="sm" onClick={() => setReportOpen(true)}>
          <Plus className="size-3.5" />
          Report
        </Button>
      </div>

      <OfflineBanner online={online} pendingCount={pending.length} />

      {myIncidents.length === 0 ? (
        <div className="flex flex-col items-center gap-xs rounded-lg border border-dashed border-border p-lg text-center">
          <AlertTriangle className="size-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No incidents reported.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-xs">
          {myIncidents.map((i) => (
            <li key={i.id} className="surface-3d flex flex-col gap-1 rounded-lg border border-border bg-surface p-sm">
              <div className="flex items-center justify-between gap-xs">
                <p className="text-sm font-medium text-foreground">{i.incidentNumber}</p>
                <Badge tone={statusTone[i.status]}>{incidentStatusLabels[i.status]}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {incidentTypeLabels[i.type]} · {formatDate(i.createdAt)}
              </p>
              <p className="text-xs text-foreground">{i.description}</p>
            </li>
          ))}
        </ul>
      )}

      <DetailDrawer open={reportOpen} onOpenChange={setReportOpen} title="Report an issue" description={trip ? `Trip ${trip.tripNumber}` : undefined}>
        <div className="flex flex-col gap-sm">
          <div>
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
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What happened?" rows={4} className="text-base" />
          <Button
            className="h-12 text-base"
            disabled={!description.trim()}
            onClick={() => {
              const submit = () =>
                reportIncident(
                  {
                    type,
                    occurredAt: new Date().toISOString(),
                    vehicleId: trip?.vehicleId,
                    routeId: trip?.routeId,
                    tripId: trip?.id,
                    reportedBy: driver.name,
                    severity,
                    description: description.trim(),
                    parentCommunicated: false,
                    authorityCommunicated: false,
                  },
                  { name: driver.name, role: "Driver" },
                );
              submit();
              if (!online) trackPendingSync(`${incidentTypeLabels[type]} report`);
              setReportOpen(false);
              setDescription("");
            }}
          >
            Submit report
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}

export default function DriverIncidentsPage() {
  return (
    <Suspense fallback={null}>
      <DriverIncidentsContent />
    </Suspense>
  );
}
