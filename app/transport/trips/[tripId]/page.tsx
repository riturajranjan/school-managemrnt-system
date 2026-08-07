"use client";

import Link from "next/link";
import { use, useState } from "react";
import { Bus, History, MapPinned, Radio, UserCog, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RouteCorridor } from "@/components/transport/route-corridor";
import { TransportAuditTrail } from "@/components/transport/audit-trail";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useTransportTrip, useTripStops, useTripStudents } from "@/lib/hooks/use-transport";
import { useSisStore } from "@/lib/hooks/use-store";
import { markStudentDrop, markStudentPickup } from "@/lib/services/pickup-drop-service";
import { markTripStopStatus, setTripStatus } from "@/lib/services/trip-service";
import {
  dropStatusLabels,
  pickupStatusLabels,
  transportShiftLabels,
  tripStatusLabels,
  tripStopStatusLabels,
  verificationMethodLabels,
  type DropStatus,
  type PickupStatus,
  type TripStatus,
  type VerificationMethod,
} from "@/lib/types/transport";
import { formatDate } from "@/lib/utils";

const ACTOR = { name: "Dispatcher", role: "Dispatcher" };
const statusOptions = Object.keys(tripStatusLabels) as TripStatus[];
const pickupStatusOptions = Object.keys(pickupStatusLabels) as PickupStatus[];
const dropStatusOptions = Object.keys(dropStatusLabels) as DropStatus[];
const verificationOptions = Object.keys(verificationMethodLabels) as VerificationMethod[];

const tripStatusTone: Record<TripStatus, "success" | "warning" | "error" | "neutral"> = {
  scheduled: "neutral",
  ready: "neutral",
  boarding: "warning",
  "in-progress": "success",
  delayed: "warning",
  paused: "warning",
  breakdown: "error",
  emergency: "error",
  completed: "success",
  cancelled: "neutral",
};

const pickupTone: Record<PickupStatus, "success" | "warning" | "error" | "neutral"> = {
  expected: "neutral",
  waiting: "warning",
  boarded: "success",
  missed: "error",
  absent: "neutral",
  "cancelled-by-parent": "neutral",
  "alternate-pickup": "success",
  "not-confirmed": "neutral",
};

const dropTone: Record<DropStatus, "success" | "warning" | "error" | "neutral"> = {
  onboard: "neutral",
  approaching: "warning",
  dropped: "success",
  "parent-unavailable": "error",
  "alternate-guardian": "success",
  "returned-to-school": "warning",
  "not-confirmed": "neutral",
};

export default function TripDetailPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = use(params);
  const trip = useTransportTrip(tripId);
  const tripStops = useTripStops(tripId);
  const tripStudents = useTripStudents(tripId);
  const db = useSisStore();
  const { can } = usePermissions();
  const canManageTrip = can("transport.manageTrips");
  const canMarkAttendance = can("transport.markAttendance") || canManageTrip;

  const [pickupDrawer, setPickupDrawer] = useState<{ studentId: string; kind: "pickup" | "drop" } | null>(null);
  const [statusValue, setStatusValue] = useState<PickupStatus | DropStatus>("boarded");
  const [verification, setVerification] = useState<VerificationMethod>("attendant-confirmation");
  const [reason, setReason] = useState("");
  const [guardianName, setGuardianName] = useState("");

  if (!trip) {
    return (
      <div className="flex flex-col items-center gap-sm py-2xl text-center">
        <p className="text-sm font-medium text-foreground">Trip not found</p>
        <Button asChild variant="outline">
          <Link href="/transport/trips">Back to trips</Link>
        </Button>
      </div>
    );
  }

  const route = db.transportRoutes.find((r) => r.id === trip.routeId);
  const vehicle = db.vehicles.find((v) => v.id === trip.vehicleId);
  const driver = db.drivers.find((d) => d.id === trip.driverId);
  const attendant = db.attendants.find((a) => a.id === trip.attendantId);
  const gpsPosition = [...db.gpsPositions].filter((p) => p.vehicleId === trip.vehicleId).sort((a, b) => (a.recordedAt < b.recordedAt ? 1 : -1))[0];

  function studentName(id: string) {
    const student = db.students.find((s) => s.id === id);
    return student ? `${student.profile.firstName} ${student.profile.lastName}` : id;
  }
  function stopName(id: string) {
    return db.transportStops.find((s) => s.id === id)?.name ?? id;
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">{trip.tripNumber}</h1>
          <p className="text-xs text-muted-foreground">
            {route?.name ?? trip.routeId} · {transportShiftLabels[trip.shift]} · {formatDate(trip.date)}
          </p>
        </div>
        {canManageTrip && (
          <Select value={trip.status} onValueChange={(v) => setTripStatus(trip.id, v as TripStatus, ACTOR)}>
            <SelectTrigger className="w-44" aria-label="Trip status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((s) => (
                <SelectItem key={s} value={s}>
                  {tripStatusLabels[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <div className="surface-3d rounded-lg border border-border bg-surface p-sm">
          <p className="text-xs text-muted-foreground">Boarded</p>
          <p className="text-xl font-bold text-foreground">
            {trip.studentsBoarded}/{trip.studentsExpected}
          </p>
        </div>
        <div className="surface-3d rounded-lg border border-border bg-surface p-sm">
          <p className="text-xs text-muted-foreground">Dropped</p>
          <p className="text-xl font-bold text-foreground">{trip.studentsDropped}</p>
        </div>
        <div className="surface-3d rounded-lg border border-border bg-surface p-sm">
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Radio className="size-3" /> GPS
          </p>
          <p className="text-sm font-medium text-foreground">{gpsPosition ? `${gpsPosition.speedKmh} km/h` : "No signal"}</p>
        </div>
        <div className="surface-3d rounded-lg border border-border bg-surface p-sm">
          <p className="text-xs text-muted-foreground">Status</p>
          <Badge tone={tripStatusTone[trip.status]}>{tripStatusLabels[trip.status]}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-sm sm:grid-cols-3">
        <div className="rounded-lg border border-border p-sm">
          <p className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <Bus className="size-3.5" /> Vehicle
          </p>
          <Link href={`/transport/vehicles/${vehicle?.id}`} className="text-sm text-foreground underline-offset-2 hover:underline">
            {vehicle?.registrationNumber ?? "—"}
          </Link>
        </div>
        <div className="rounded-lg border border-border p-sm">
          <p className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <UserCog className="size-3.5" /> Driver
          </p>
          <Link href={`/transport/drivers/${driver?.id}`} className="text-sm text-foreground underline-offset-2 hover:underline">
            {driver?.name ?? "—"}
          </Link>
        </div>
        <div className="rounded-lg border border-border p-sm">
          <p className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <Users className="size-3.5" /> Attendant
          </p>
          <p className="text-sm text-foreground">{attendant?.name ?? "—"}</p>
        </div>
      </div>

      <RouteCorridor
        stops={tripStops.map((ts) => ({ id: ts.id, name: stopName(ts.stopId), status: ts.status }))}
        hasDelay={trip.status === "delayed"}
        hasIncident={db.transportIncidents.some((i) => i.tripId === trip.id && i.status !== "resolved" && i.status !== "closed")}
        onSelectStop={(stopTripStopId) => {
          const el = document.getElementById(`stop-${stopTripStopId}`);
          el?.scrollIntoView({ behavior: "smooth", block: "center" });
        }}
      />

      <div className="rounded-lg border border-border p-sm">
        <h2 className="mb-sm flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <MapPinned className="size-4" /> Stop timeline
        </h2>
        <ol className="flex flex-col gap-1">
          {tripStops.map((ts) => (
            <li key={ts.id} id={`stop-${ts.id}`} className="flex items-center justify-between gap-xs rounded-md border border-border px-sm py-1.5 scroll-mt-4">
              <span className="min-w-0 truncate text-sm text-foreground">
                {ts.sequence}. {stopName(ts.stopId)}
              </span>
              <div className="flex shrink-0 items-center gap-1">
                <Badge tone={ts.status === "departed" ? "success" : ts.status === "arrived" ? "warning" : "neutral"}>{tripStopStatusLabels[ts.status]}</Badge>
                {canManageTrip && ts.status !== "departed" && (
                  <Button size="sm" variant="ghost" onClick={() => markTripStopStatus(ts.id, ts.status === "pending" ? "arrived" : "departed", ACTOR)}>
                    {ts.status === "pending" ? "Mark arrived" : "Mark departed"}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="rounded-lg border border-border p-sm">
        <h2 className="mb-sm text-sm font-semibold text-foreground">Students ({tripStudents.length})</h2>
        {tripStudents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No students on this trip&apos;s roster.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {tripStudents.map((ts) => (
              <li key={ts.id} className="flex flex-col gap-1 rounded-md border border-border p-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{studentName(ts.studentId)}</p>
                  <p className="text-xs text-muted-foreground">{stopName(ts.stopId)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-xs">
                  <Badge tone={pickupTone[ts.pickupStatus]}>{pickupStatusLabels[ts.pickupStatus]}</Badge>
                  <Badge tone={dropTone[ts.dropStatus]}>{dropStatusLabels[ts.dropStatus]}</Badge>
                  {canMarkAttendance && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setPickupDrawer({ studentId: ts.studentId, kind: "pickup" });
                          setStatusValue("boarded");
                          setVerification("attendant-confirmation");
                          setReason("");
                        }}
                      >
                        Pickup
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setPickupDrawer({ studentId: ts.studentId, kind: "drop" });
                          setStatusValue("dropped");
                          setVerification("attendant-confirmation");
                          setGuardianName("");
                          setReason("");
                        }}
                      >
                        Drop
                      </Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-lg border border-border p-sm">
        <h2 className="mb-sm flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <History className="size-4" /> Audit trail
        </h2>
        <TransportAuditTrail events={db.transportAuditLog.filter((e) => e.subjectId === tripId)} />
      </div>

      <DetailDrawer open={!!pickupDrawer} onOpenChange={(open) => !open && setPickupDrawer(null)} title={pickupDrawer ? `Mark ${pickupDrawer.kind}` : ""} description={pickupDrawer ? studentName(pickupDrawer.studentId) : undefined}>
        {pickupDrawer && (
          <div className="flex flex-col gap-sm">
            <div>
              <Label>Status</Label>
              <Select value={statusValue} onValueChange={(v) => setStatusValue(v as PickupStatus | DropStatus)}>
                <SelectTrigger aria-label="Status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(pickupDrawer.kind === "pickup" ? pickupStatusOptions : dropStatusOptions).map((s) => (
                    <SelectItem key={s} value={s}>
                      {pickupDrawer.kind === "pickup" ? pickupStatusLabels[s as PickupStatus] : dropStatusLabels[s as DropStatus]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Verification</Label>
              <Select value={verification} onValueChange={(v) => setVerification(v as VerificationMethod)}>
                <SelectTrigger aria-label="Verification method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {verificationOptions.map((v) => (
                    <SelectItem key={v} value={v}>
                      {verificationMethodLabels[v]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {pickupDrawer.kind === "drop" && (
              <div>
                <Label htmlFor="guardian-name">Guardian name (if alternate)</Label>
                <Input id="guardian-name" value={guardianName} onChange={(e) => setGuardianName(e.target.value)} placeholder="Optional" />
              </div>
            )}
            <div>
              <Label htmlFor="mark-reason">Reason / note</Label>
              <Input id="mark-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional" />
            </div>
            <Button
              onClick={() => {
                if (pickupDrawer.kind === "pickup") {
                  markStudentPickup(trip.id, pickupDrawer.studentId, statusValue as PickupStatus, ACTOR, verification, reason.trim() || undefined);
                } else {
                  markStudentDrop(trip.id, pickupDrawer.studentId, statusValue as DropStatus, ACTOR, verification, guardianName.trim() || undefined, reason.trim() || undefined);
                }
                setPickupDrawer(null);
              }}
            >
              Save
            </Button>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
