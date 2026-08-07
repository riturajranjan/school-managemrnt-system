"use client";

import { useState } from "react";
import { AlertOctagon, Bus, MapPinned, Phone, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RouteCorridor } from "@/components/transport/route-corridor";
import { useParentDirectory } from "@/lib/hooks/use-parents";
import { useSisStore } from "@/lib/hooks/use-store";
import { formatMoney } from "@/lib/finance/money";
import { logTransportAudit } from "@/lib/services/transport-audit-service";
import {
  markStudentDrop,
  markStudentPickup,
} from "@/lib/services/pickup-drop-service";
import {
  computeVehicleLiveState,
  vehicleLiveStateLabels,
} from "@/lib/selectors/live-tracking";
import {
  dropStatusLabels,
  pickupStatusLabels,
  transportShiftLabels,
} from "@/lib/types/transport";

const TRANSPORT_OFFICE_PHONE = "+911234567890";

export default function ParentTransportPage() {
  const directory = useParentDirectory();
  const db = useSisStore();
  const today = new Date().toISOString().slice(0, 10);

  const [requestOpen, setRequestOpen] = useState<"stop" | "guardian" | null>(
    null,
  );
  const [requestNote, setRequestNote] = useState("");
  const [sentMessage, setSentMessage] = useState<string | null>(null);

  const parentRow = directory.find((row) =>
    row.children.some(({ student }) =>
      db.studentTransportAssignments.some(
        (a) => a.studentId === student.id && a.status === "active",
      ),
    ),
  );

  if (!parentRow) {
    return (
      <div className="mx-auto flex  flex-col items-center gap-sm py-2xl text-center">
        <Bus className="size-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          No child currently uses school transport.
        </p>
      </div>
    );
  }

  const childrenWithTransport = parentRow.children.filter(
    ({ student }) => student.transport,
  );

  return (
    <div className="mx-auto flex w-full  flex-col gap-lg pb-24 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Transport</h1>
        <p className="text-xs text-muted-foreground">
          {parentRow.guardian.firstName} {parentRow.guardian.lastName}
        </p>
      </div>

      {sentMessage && (
        <p className="rounded-md bg-success/10 p-sm text-xs text-success">
          {sentMessage}
        </p>
      )}

      {childrenWithTransport.map(({ student }) => {
        const assignment = db.studentTransportAssignments.find(
          (a) => a.studentId === student.id && a.status === "active",
        );
        const route = db.transportRoutes.find(
          (r) => r.id === assignment?.routeId,
        );
        const driver = db.drivers.find((d) => d.id === route?.primaryDriverId);
        const attendant = db.attendants.find(
          (a) => a.id === route?.attendantId,
        );
        const pickupStop = db.transportStops.find(
          (s) => s.id === assignment?.pickupStopId,
        );
        const dropStop = db.transportStops.find(
          (s) => s.id === assignment?.dropStopId,
        );
        const feeRule = db.transportFeeRules.find(
          (f) => f.routeId === route?.id,
        );
        const trip = db.transportTrips.find(
          (t) => t.routeId === route?.id && t.date === today,
        );
        const tripStudent = trip
          ? db.tripStudents.find(
              (ts) => ts.tripId === trip.id && ts.studentId === student.id,
            )
          : undefined;
        const tripStops = trip
          ? db.tripStops
              .filter((s) => s.tripId === trip.id)
              .sort((a, b) => a.sequence - b.sequence)
          : [];
        const liveState = trip ? computeVehicleLiveState(db, trip) : undefined;
        const actor = {
          name: `${parentRow.guardian.firstName} ${parentRow.guardian.lastName}`,
          role: "Parent",
        };

        return (
          <div key={student.id} className="flex flex-col gap-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">
                {student.profile.firstName} {student.profile.lastName}
              </h2>
              {liveState && (
                <Badge
                  tone={
                    liveState === "off-route" ||
                    liveState === "breakdown" ||
                    liveState === "emergency"
                      ? "error"
                      : liveState === "delayed"
                        ? "warning"
                        : "success"
                  }>
                  {vehicleLiveStateLabels[liveState]}
                </Badge>
              )}
            </div>

            <div className="surface-3d rounded-lg border border-border bg-surface p-md">
              <dl className="grid grid-cols-2 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Route</dt>
                <dd className="text-foreground">{route?.name ?? "—"}</dd>
                <dt className="text-muted-foreground">Driver</dt>
                <dd className="text-foreground">{driver?.name ?? "—"}</dd>
                <dt className="text-muted-foreground">Attendant</dt>
                <dd className="text-foreground">{attendant?.name ?? "—"}</dd>
                <dt className="text-muted-foreground">Shift</dt>
                <dd className="text-foreground">
                  {assignment ? transportShiftLabels[assignment.shift] : "—"}
                </dd>
                <dt className="text-muted-foreground">Pickup</dt>
                <dd className="text-foreground">{pickupStop?.name ?? "—"}</dd>
                <dt className="text-muted-foreground">Drop</dt>
                <dd className="text-foreground">{dropStop?.name ?? "—"}</dd>
              </dl>
            </div>

            {trip && tripStops.length > 0 && (
              <div>
                <p className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  <MapPinned className="size-3.5" /> Today&apos;s trip
                </p>
                <RouteCorridor
                  stops={tripStops.map((s) => ({
                    id: s.id,
                    name:
                      db.transportStops.find((st) => st.id === s.stopId)
                        ?.name ?? s.stopId,
                    status: s.status,
                  }))}
                  hasDelay={trip.status === "delayed"}
                />
              </div>
            )}

            {tripStudent && (
              <div className="flex items-center justify-between rounded-md border border-border p-sm text-sm">
                <span className="text-muted-foreground">
                  Pickup / drop status
                </span>
                <span className="text-foreground">
                  {pickupStatusLabels[tripStudent.pickupStatus]} ·{" "}
                  {dropStatusLabels[tripStudent.dropStatus]}
                </span>
              </div>
            )}

            {feeRule && (
              <div className="flex items-center justify-between rounded-md border border-border p-sm text-sm">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Wallet className="size-3.5" /> Transport fee
                </span>
                <span className="font-medium text-foreground">
                  {formatMoney(feeRule.amount)} / {feeRule.frequency}
                </span>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-xs">
              {trip &&
                tripStudent &&
                (tripStudent.pickupStatus === "expected" ||
                  tripStudent.pickupStatus === "waiting") && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      markStudentPickup(
                        trip.id,
                        student.id,
                        "cancelled-by-parent",
                        actor,
                        "parent-app-confirmation",
                        "Marked absent by parent",
                      );
                      setSentMessage(
                        `${student.profile.firstName} marked absent from transport today.`,
                      );
                    }}>
                    Mark absent today
                  </Button>
                )}
              {trip &&
                tripStudent &&
                (tripStudent.dropStatus === "onboard" ||
                  tripStudent.dropStatus === "approaching") && (
                  <Button
                    size="sm"
                    onClick={() => {
                      markStudentDrop(
                        trip.id,
                        student.id,
                        "dropped",
                        actor,
                        "parent-app-confirmation",
                      );
                      setSentMessage(
                        `Drop confirmed for ${student.profile.firstName}.`,
                      );
                    }}>
                    Confirm drop
                  </Button>
                )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setRequestOpen("stop")}>
                Request stop change
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setRequestOpen("guardian")}>
                Request alternate guardian
              </Button>
            </div>
          </div>
        );
      })}

      <div className="flex flex-col gap-xs border-t border-border pt-sm">
        <Button asChild variant="destructive" size="sm">
          <a href={`tel:${TRANSPORT_OFFICE_PHONE}`}>
            <AlertOctagon className="size-3.5" />
            Emergency — call transport office
          </a>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <a href={`tel:${TRANSPORT_OFFICE_PHONE}`}>
            <Phone className="size-3.5" />
            Contact transport office
          </a>
        </Button>
      </div>

      <DetailDrawer
        open={!!requestOpen}
        onOpenChange={(open) => {
          if (!open) setRequestOpen(null);
        }}
        title={
          requestOpen === "stop"
            ? "Request stop change"
            : "Request alternate guardian"
        }
        description="Sent to the transport office for approval — your child's route won't change until it's confirmed">
        <div className="flex flex-col gap-sm">
          <div>
            <Label htmlFor="request-note">Details</Label>
            <Input
              id="request-note"
              value={requestNote}
              onChange={(e) => setRequestNote(e.target.value)}
              placeholder={
                requestOpen === "stop"
                  ? "New stop and reason"
                  : "Guardian name and relation"
              }
            />
          </div>
          <Button
            disabled={!requestNote.trim()}
            onClick={() => {
              logTransportAudit({
                action: "manual-override-used",
                actorName: `${parentRow.guardian.firstName} ${parentRow.guardian.lastName}`,
                actorRole: "Parent",
                summary: `Parent requested ${requestOpen === "stop" ? "a stop change" : "an alternate guardian"}: ${requestNote.trim()}`,
                reason:
                  "Parent-submitted request awaiting transport office review",
              });
              setSentMessage(
                "Request sent to the transport office for review.",
              );
              setRequestOpen(null);
              setRequestNote("");
            }}>
            Send request
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
