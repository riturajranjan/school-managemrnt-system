"use client";

// Trip detail (Phase 9M) — real PostgreSQL/API cutover. No GPS/speed tile and
// no mock audit-trail component — those had no honest real backing.
import { useParams, useRouter } from "next/navigation";
import { CheckCircle2, ChevronLeft, CircleDot, MapPin, Users, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import {
  cancelTripRequest,
  completeTripRequest,
  markBoardingRequest,
  markDropRequest,
  markTripStopRequest,
  startTripRequest,
  useTransportTrip,
} from "@/lib/hooks/api/use-transport-api";
import { roleLabels } from "@/lib/permissions/roles";
import type {
  TransportBoardingStatusDto,
  TransportDropStatusDto,
  TransportTripStatusDto,
  TransportTripStopStatusDto,
} from "@/lib/api/contracts";
import { formatDate } from "@/lib/utils";

const statusTone: Record<TransportTripStatusDto, "success" | "warning" | "error" | "neutral"> = { scheduled: "neutral", "in-progress": "success", completed: "success", cancelled: "neutral" };
const stopStatusTone: Record<TransportTripStopStatusDto, "success" | "warning" | "error" | "neutral"> = { pending: "neutral", arrived: "warning", departed: "success" };
const boardingTone: Record<TransportBoardingStatusDto, "success" | "warning" | "error" | "neutral"> = { expected: "neutral", boarded: "success", absent: "error" };
const dropTone: Record<TransportDropStatusDto, "success" | "warning" | "error" | "neutral"> = { onboard: "warning", dropped: "success" };

export default function TripDetailPage() {
  const params = useParams<{ tripId: string }>();
  const router = useRouter();
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: trip, loading, error, reload } = useTransportTrip(params.tripId);

  if (!capabilitiesLoading && !hasServerPermission("transport.view")) {
    return <PermissionDenied action="view this trip" role={roleLabels[role]} backHref="/transport/trips" />;
  }
  const canManage = hasServerPermission("transport.manage");

  if (loading && !trip) return <p className="p-md text-sm text-muted-foreground">Loading…</p>;
  if (error || !trip) return <p className="p-md text-sm text-muted-foreground">{error ?? "Trip not found"}</p>;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <button type="button" onClick={() => router.push("/transport/trips")} className="flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-3.5" />
        Back to trips
      </button>

      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">{trip.routeName}</h1>
          <p className="text-xs text-muted-foreground">{formatDate(trip.date)} · {trip.type} trip</p>
        </div>
        <Badge tone={statusTone[trip.status]}>{trip.status}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-sm rounded-lg border border-border bg-surface p-md sm:grid-cols-4">
        <Field label="Vehicle" value={trip.vehicleRegistration ?? "—"} />
        <Field label="Driver" value={trip.driverName ?? "—"} />
        <Field label="Attendant" value={trip.attendantName ?? "—"} />
        <Field label="Students" value={`${trip.studentsBoarded}/${trip.studentsExpected}`} />
      </div>

      {canManage && (
        <div className="flex flex-wrap gap-xs">
          {trip.status === "scheduled" && (
            <Button size="sm" onClick={async () => { await startTripRequest(trip.id); reload(); }}>
              <CircleDot className="size-3.5" />
              Start trip
            </Button>
          )}
          {trip.status === "in-progress" && (
            <Button size="sm" onClick={async () => { await completeTripRequest(trip.id); reload(); }}>
              <CheckCircle2 className="size-3.5" />
              Complete trip
            </Button>
          )}
          {(trip.status === "scheduled" || trip.status === "in-progress") && (
            <Button size="sm" variant="destructive" onClick={async () => { await cancelTripRequest(trip.id); reload(); }}>
              <XCircle className="size-3.5" />
              Cancel trip
            </Button>
          )}
        </div>
      )}

      <section className="flex flex-col gap-sm">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <MapPin className="size-4" />
          Stop timeline
        </h2>
        <div className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
          {trip.stops.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-sm p-sm">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{s.sequence}. {s.stopName}</p>
                <p className="text-xs text-muted-foreground">
                  {s.arrivedAt ? `Arrived ${new Date(s.arrivedAt).toLocaleTimeString()}` : "Not arrived"}
                  {s.departedAt ? ` · Departed ${new Date(s.departedAt).toLocaleTimeString()}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-xs">
                <Badge tone={stopStatusTone[s.status]}>{s.status}</Badge>
                {canManage && s.status === "pending" && (
                  <Button size="sm" variant="outline" onClick={async () => { await markTripStopRequest(trip.id, s.id, "arrived"); reload(); }}>Mark arrived</Button>
                )}
                {canManage && s.status === "arrived" && (
                  <Button size="sm" variant="outline" onClick={async () => { await markTripStopRequest(trip.id, s.id, "departed"); reload(); }}>Mark departed</Button>
                )}
              </div>
            </div>
          ))}
          {trip.stops.length === 0 && <p className="p-md text-center text-sm text-muted-foreground">No stops on this route</p>}
        </div>
      </section>

      <section className="flex flex-col gap-sm">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Users className="size-4" />
          Students
        </h2>
        <div className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
          {trip.students.map((s) => (
            <div key={s.id} className="flex flex-col gap-xs p-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{s.studentName}</p>
                <p className="text-xs text-muted-foreground">{s.stopName}</p>
              </div>
              <div className="flex flex-wrap items-center gap-xs">
                <Badge tone={boardingTone[s.boardingStatus]}>{s.boardingStatus}</Badge>
                <Badge tone={dropTone[s.dropStatus]}>{s.dropStatus}</Badge>
                {canManage && s.boardingStatus === "expected" && (
                  <>
                    <Button size="sm" variant="outline" onClick={async () => { await markBoardingRequest(trip.id, s.id, { status: "boarded" }); reload(); }}>Board</Button>
                    <Button size="sm" variant="outline" onClick={async () => { await markBoardingRequest(trip.id, s.id, { status: "absent" }); reload(); }}>Absent</Button>
                  </>
                )}
                {canManage && s.boardingStatus === "boarded" && s.dropStatus === "onboard" && (
                  <Button size="sm" variant="outline" onClick={async () => { await markDropRequest(trip.id, s.id, { status: "dropped" }); reload(); }}>Drop</Button>
                )}
              </div>
            </div>
          ))}
          {trip.students.length === 0 && <p className="p-md text-center text-sm text-muted-foreground">No students assigned to this route</p>}
        </div>
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
