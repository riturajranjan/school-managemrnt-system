"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertOctagon, Check, CloudCheck, Phone, UserX, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OfflineBanner } from "@/components/transport/offline-banner";
import { useCurrentAttendant } from "@/lib/hooks/use-transport";
import { useSisStore } from "@/lib/hooks/use-store";
import { trackPendingSync, useIsOnline, usePendingSync } from "@/lib/offline/offline-status";
import {
  markStudentDrop,
  markStudentPickup,
} from "@/lib/services/pickup-drop-service";
import { setTripStatus } from "@/lib/services/trip-service";
import { pickupStatusLabels, type PickupStatus } from "@/lib/types/transport";

const MISSED_REASONS = [
  "Not at stop",
  "Parent said absent today",
  "Went with another guardian",
  "No response at pickup",
];

/** The one-hand attendant workflow (spec's "attendant mobile app") — the
 * required route for this is /transport/pickup-drop, since section 1 has
 * no separate /attendant/* route group. Large tap targets throughout,
 * minimal steps per action. */
export default function PickupDropPage() {
  const attendant = useCurrentAttendant();
  const db = useSisStore();
  const today = new Date().toISOString().slice(0, 10);
  const online = useIsOnline();
  const pending = usePendingSync();

  const [missedTarget, setMissedTarget] = useState<string | null>(null);
  const [missedReason, setMissedReason] = useState(MISSED_REASONS[0]);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [guardianName, setGuardianName] = useState("");

  if (!attendant) {
    return (
      <div className="mx-auto flex  flex-col items-center gap-sm py-2xl text-center">
        <p className="text-sm text-muted-foreground">
          No attendant profile found for preview.
        </p>
      </div>
    );
  }

  const actor = { name: attendant.name, role: "Attendant" };
  const trip = db.transportTrips.find(
    (t) =>
      t.attendantId === attendant.id &&
      t.date === today &&
      (t.status === "boarding" ||
        t.status === "in-progress" ||
        t.status === "delayed"),
  );

  if (!trip) {
    return (
      <div className="mx-auto flex w-full  flex-col items-center gap-sm py-2xl text-center">
        <CloudCheck className="size-6 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">
          No active trip right now
        </p>
        <p className="text-xs text-muted-foreground">
          This screen activates once your driver starts a trip.
        </p>
      </div>
    );
  }

  const route = db.transportRoutes.find((r) => r.id === trip.routeId);
  const tripStudents = db.tripStudents.filter((ts) => ts.tripId === trip.id);
  const currentStop =
    db.tripStops
      .filter((s) => s.tripId === trip.id)
      .find((s) => s.status === "arrived") ??
    db.tripStops
      .filter((s) => s.tripId === trip.id)
      .find((s) => s.status === "pending");
  const studentsHere = currentStop
    ? tripStudents.filter((ts) => ts.stopId === currentStop.stopId)
    : [];
  const boardedCount = tripStudents.filter(
    (ts) =>
      ts.pickupStatus === "boarded" || ts.pickupStatus === "alternate-pickup",
  ).length;
  const missedCount = tripStudents.filter(
    (ts) => ts.pickupStatus === "missed",
  ).length;

  function studentName(id: string) {
    const student = db.students.find((s) => s.id === id);
    return student
      ? `${student.profile.firstName} ${student.profile.lastName}`
      : id;
  }
  /** The action itself always runs immediately — this store is already
   * local and persisted, so there's nothing to lose. While offline, it's
   * additionally logged to the pending-sync list purely so the attendant
   * sees confirmation is still owed once connectivity returns. */
  function runAction(label: string, action: () => void) {
    action();
    if (!online) trackPendingSync(label);
  }
  function guardianPhone(studentId: string) {
    const links = db.studentGuardianLinks.filter(
      (l) => l.studentId === studentId,
    );
    const primaryLink = links.find((l) => l.isPrimary) ?? links[0];
    if (!primaryLink) return undefined;
    const guardian = db.guardians.find((g) => g.id === primaryLink.guardianId);
    return guardian?.contact.phone;
  }

  return (
    <div className="mx-auto flex w-full  flex-col gap-md pb-24 sm:pb-0">
      <div className="flex items-center justify-between gap-xs">
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            {route?.name ?? trip.routeId}
          </h1>
          <p className="text-xs text-muted-foreground">
            {currentStop
              ? db.transportStops.find((s) => s.id === currentStop.stopId)?.name
              : "Trip complete"}
          </p>
        </div>
        <span className={`flex items-center gap-1 text-[11px] ${online ? "text-success" : "text-warning"}`}>
          <CloudCheck className="size-3.5" /> {online ? "Synced" : "Offline"}
        </span>
      </div>

      <OfflineBanner online={online} pendingCount={pending.length} />

      <div className="grid grid-cols-3 gap-xs">
        <div className="surface-3d rounded-lg border border-border bg-surface p-sm text-center">
          <p className="text-xs text-muted-foreground">Expected</p>
          <p className="text-lg font-bold text-foreground">
            {trip.studentsExpected}
          </p>
        </div>
        <div className="surface-3d rounded-lg border border-border bg-surface p-sm text-center">
          <p className="text-xs text-muted-foreground">Boarded</p>
          <p className="text-lg font-bold text-success">{boardedCount}</p>
        </div>
        <div className="surface-3d rounded-lg border border-border bg-surface p-sm text-center">
          <p className="text-xs text-muted-foreground">Missed</p>
          <p className="text-lg font-bold text-error">{missedCount}</p>
        </div>
      </div>

      <div className="flex flex-col gap-sm">
        <h2 className="text-sm font-semibold text-foreground">At this stop</h2>
        {studentsHere.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No students expected at this stop.
          </p>
        ) : (
          studentsHere.map((ts) => (
            <div
              key={ts.id}
              className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
              <div className="flex items-center justify-between gap-xs">
                <p className="text-base font-medium text-foreground">
                  {studentName(ts.studentId)}
                </p>
                <Badge
                  tone={
                    ts.pickupStatus === "boarded"
                      ? "success"
                      : ts.pickupStatus === "missed"
                        ? "error"
                        : "neutral"
                  }>
                  {pickupStatusLabels[ts.pickupStatus]}
                </Badge>
              </div>
              {ts.pickupStatus === "expected" ||
              ts.pickupStatus === "waiting" ? (
                <div className="grid grid-cols-2 gap-xs">
                  <Button
                    className="h-14 text-base"
                    onClick={() =>
                      runAction(`${studentName(ts.studentId)} boarded`, () =>
                        markStudentPickup(
                          trip.id,
                          ts.studentId,
                          "boarded",
                          actor,
                          "attendant-confirmation",
                        ),
                      )
                    }>
                    <Check className="size-5" />
                    Boarded
                  </Button>
                  <Button
                    variant="outline"
                    className="h-14 text-base"
                    onClick={() => {
                      setMissedTarget(ts.studentId);
                      setMissedReason(MISSED_REASONS[0]);
                    }}>
                    <UserX className="size-5" />
                    Missed
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-xs">
                  {guardianPhone(ts.studentId) && (
                    <Button asChild variant="ghost" size="sm">
                      <a href={`tel:${guardianPhone(ts.studentId)}`}>
                        <Phone className="size-3.5" /> Call parent
                      </a>
                    </Button>
                  )}
                  {ts.dropStatus === "onboard" ||
                  ts.dropStatus === "approaching" ||
                  ts.dropStatus === "not-confirmed" ? (
                    <Button
                      size="sm"
                      onClick={() => {
                        setDropTarget(ts.studentId);
                        setGuardianName("");
                      }}>
                      Mark dropped
                    </Button>
                  ) : null}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="flex items-center gap-xs">
        <Button
          variant="destructive"
          className="flex-1"
          onClick={() =>
            runAction("Emergency declared", () =>
              setTripStatus(
                trip.id,
                "emergency",
                actor,
                "Emergency declared by attendant",
              ),
            )
          }>
          <AlertOctagon className="size-3.5" />
          Emergency
        </Button>
        <Button asChild variant="outline" className="flex-1">
          <Link href={`/driver/incidents?tripId=${trip.id}`}>Report issue</Link>
        </Button>
      </div>

      <DetailDrawer
        open={!!missedTarget}
        onOpenChange={(open) => !open && setMissedTarget(null)}
        title="Missed pickup"
        description={missedTarget ? studentName(missedTarget) : undefined}>
        <div className="flex flex-col gap-sm">
          <div>
            <Label>Reason</Label>
            <Select value={missedReason} onValueChange={setMissedReason}>
              <SelectTrigger aria-label="Missed reason">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MISSED_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="destructive"
            className="h-12 text-base"
            onClick={() => {
              if (missedTarget)
                runAction(`${studentName(missedTarget)} missed pickup`, () =>
                  markStudentPickup(
                    trip.id,
                    missedTarget,
                    "missed" as PickupStatus,
                    actor,
                    undefined,
                    missedReason,
                  ),
                );
              setMissedTarget(null);
            }}>
            <X className="size-4" />
            Confirm missed
          </Button>
        </div>
      </DetailDrawer>

      <DetailDrawer
        open={!!dropTarget}
        onOpenChange={(open) => !open && setDropTarget(null)}
        title="Confirm drop"
        description={dropTarget ? studentName(dropTarget) : undefined}>
        <div className="flex flex-col gap-sm">
          <Button
            className="h-12 text-base"
            onClick={() => {
              if (dropTarget)
                runAction(`${studentName(dropTarget)} dropped`, () =>
                  markStudentDrop(
                    trip.id,
                    dropTarget,
                    "dropped",
                    actor,
                    "attendant-confirmation",
                  ),
                );
              setDropTarget(null);
            }}>
            Parent present — confirm drop
          </Button>
          <div>
            <Label htmlFor="alt-guardian">Alternate guardian name</Label>
            <Input
              id="alt-guardian"
              value={guardianName}
              onChange={(e) => setGuardianName(e.target.value)}
              placeholder="Name of person collecting"
            />
          </div>
          <Button
            variant="outline"
            className="h-12 text-base"
            disabled={!guardianName.trim()}
            onClick={() => {
              if (dropTarget)
                runAction(`${studentName(dropTarget)} alternate guardian collected`, () =>
                  markStudentDrop(
                    trip.id,
                    dropTarget,
                    "alternate-guardian",
                    actor,
                    "authorized-guardian",
                    guardianName.trim(),
                  ),
                );
              setDropTarget(null);
            }}>
            Alternate guardian collected
          </Button>
          <Button
            variant="ghost"
            className="h-12 text-base text-error"
            onClick={() => {
              if (dropTarget)
                runAction(`${studentName(dropTarget)} parent unavailable`, () =>
                  markStudentDrop(
                    trip.id,
                    dropTarget,
                    "parent-unavailable",
                    actor,
                    "manual-with-reason",
                    undefined,
                    "No authorized guardian present at drop",
                  ),
                );
              setDropTarget(null);
            }}>
            Parent unavailable
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
