"use client";

import Link from "next/link";
import { use } from "react";
import { AlertTriangle, Award, Bus, History, Phone, Route, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TransportAuditTrail } from "@/components/transport/audit-trail";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useDriver, useDriverDocuments, useDriverTraining } from "@/lib/hooks/use-transport";
import { useSisStore } from "@/lib/hooks/use-store";
import { computeDriverSafety } from "@/lib/selectors/driver-safety";
import { setDriverStatus } from "@/lib/services/driver-service";
import { driverDocumentTypeLabels, driverStatusLabels, transportDocumentStatusLabels, type DriverStatus } from "@/lib/types/transport";
import { formatDate } from "@/lib/utils";

const ACTOR = { name: "Transport Administrator", role: "Transport Administrator" };
const statusOptions = Object.keys(driverStatusLabels) as DriverStatus[];

const docStatusTone: Record<string, "success" | "warning" | "error" | "neutral"> = {
  valid: "success",
  "expiring-soon": "warning",
  expired: "error",
  missing: "error",
  "under-review": "neutral",
  rejected: "error",
};

export default function DriverProfilePage({ params }: { params: Promise<{ driverId: string }> }) {
  const { driverId } = use(params);
  const driver = useDriver(driverId);
  const db = useSisStore();
  const documents = useDriverDocuments(driverId);
  const training = useDriverTraining(driverId);
  const { can } = usePermissions();
  const canManage = can("transport.manageDrivers");

  if (!driver) {
    return (
      <div className="flex flex-col items-center gap-sm py-2xl text-center">
        <p className="text-sm font-medium text-foreground">Driver not found</p>
        <Button asChild variant="outline">
          <Link href="/transport/drivers">Back to drivers</Link>
        </Button>
      </div>
    );
  }

  const safety = computeDriverSafety(db, driver);
  const routesAsPrimary = db.transportRoutes.filter((r) => r.primaryDriverId === driver.id);
  const routesAsBackup = db.transportRoutes.filter((r) => r.backupDriverId === driver.id);
  const todayTrips = db.transportTrips.filter((t) => t.driverId === driver.id);
  const incidentsForDriver = db.transportIncidents.filter((i) => i.tripId && todayTrips.some((t) => t.id === i.tripId));

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">{driver.name}</h1>
          <p className="text-xs text-muted-foreground">
            {driver.employeeCode} · {driver.licenseClass}
          </p>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <Phone className="size-3" /> {driver.phone}
          </p>
        </div>
        {canManage && (
          <Select value={driver.status} onValueChange={(v) => setDriverStatus(driver.id, v as DriverStatus, ACTOR)}>
            <SelectTrigger className="w-44" aria-label="Driver status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((s) => (
                <SelectItem key={s} value={s}>
                  {driverStatusLabels[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <div className="surface-3d rounded-lg border border-border bg-surface p-sm">
          <p className="text-xs text-muted-foreground">Safety score</p>
          <p className={`text-xl font-bold ${safety.score >= 80 ? "text-success" : safety.score >= 60 ? "text-warning" : "text-error"}`}>{safety.score}</p>
        </div>
        <div className="surface-3d rounded-lg border border-border bg-surface p-sm">
          <p className="text-xs text-muted-foreground">Routes (primary)</p>
          <p className="text-xl font-bold text-foreground">{routesAsPrimary.length}</p>
        </div>
        <div className="surface-3d rounded-lg border border-border bg-surface p-sm">
          <p className="text-xs text-muted-foreground">Trips logged</p>
          <p className="text-xl font-bold text-foreground">{todayTrips.length}</p>
        </div>
        <div className="surface-3d rounded-lg border border-border bg-surface p-sm">
          <p className="text-xs text-muted-foreground">Status</p>
          <Badge tone={driver.status === "suspended" || driver.status === "license-expired" ? "error" : driver.status === "medical-review" ? "warning" : "success"}>{driverStatusLabels[driver.status]}</Badge>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <ShieldCheck className="size-4" /> Safety score breakdown
        </h2>
        <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
          {safety.components.map((c) => (
            <div key={c.key}>
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="text-sm font-medium text-foreground">{c.value}</p>
            </div>
          ))}
        </div>
        <ul className="mt-sm flex flex-col gap-1">
          {safety.explanation.map((line, i) => (
            <li key={i} className="text-xs text-muted-foreground">
              · {line}
            </li>
          ))}
        </ul>
      </div>

      <div className="grid grid-cols-1 gap-md lg:grid-cols-2">
        <div className="rounded-lg border border-border p-sm">
          <h2 className="mb-sm flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Route className="size-4" /> Routes
          </h2>
          {routesAsPrimary.length === 0 && routesAsBackup.length === 0 ? (
            <p className="text-sm text-muted-foreground">Not assigned to any route.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {routesAsPrimary.map((r) => (
                <li key={r.id} className="flex items-center justify-between text-sm">
                  <Link href={`/transport/routes/${r.id}`} className="text-foreground underline-offset-2 hover:underline">
                    {r.name}
                  </Link>
                  <Badge tone="success">Primary</Badge>
                </li>
              ))}
              {routesAsBackup.map((r) => (
                <li key={r.id} className="flex items-center justify-between text-sm">
                  <Link href={`/transport/routes/${r.id}`} className="text-foreground underline-offset-2 hover:underline">
                    {r.name}
                  </Link>
                  <Badge tone="neutral">Backup</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-border p-sm">
          <h2 className="mb-sm flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Bus className="size-4" /> Documents
          </h2>
          {documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No documents on file.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {documents.map((d) => (
                <li key={d.id} className="flex items-center justify-between text-sm">
                  <span className="capitalize text-foreground">{driverDocumentTypeLabels[d.type]}</span>
                  <Badge tone={docStatusTone[d.status]}>{transportDocumentStatusLabels[d.status]}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-border p-sm">
          <h2 className="mb-sm flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Award className="size-4" /> Training
          </h2>
          {training.length === 0 ? (
            <p className="text-sm text-muted-foreground">No training records on file.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {training.map((t) => (
                <li key={t.id} className="text-sm">
                  <p className="text-foreground">{t.title}</p>
                  <p className="text-xs text-muted-foreground">
                    Completed {formatDate(t.completedAt)}
                    {t.expiresAt ? ` · Valid until ${formatDate(t.expiresAt)}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-border p-sm">
          <h2 className="mb-sm flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <AlertTriangle className="size-4" /> Incident history
          </h2>
          {incidentsForDriver.length === 0 ? (
            <p className="text-sm text-muted-foreground">No incidents linked to this driver.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {incidentsForDriver.map((i) => (
                <li key={i.id} className="text-sm text-foreground">
                  {i.incidentNumber} — {i.type.replace(/-/g, " ")}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-border p-sm lg:col-span-2">
          <h2 className="mb-sm flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <History className="size-4" /> Audit trail
          </h2>
          <TransportAuditTrail events={db.transportAuditLog.filter((e) => e.subjectId === driverId)} />
        </div>
      </div>
    </div>
  );
}
