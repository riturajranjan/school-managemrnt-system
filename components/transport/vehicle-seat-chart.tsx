"use client";

import { useState } from "react";
import { List, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSisStore } from "@/lib/hooks/use-store";
import { assignStudentToSeat, blockSeat, clearSeat, moveStudentSeat, reserveSeat } from "@/lib/services/seat-service";
import { seatTypeLabels, type Vehicle, type VehicleSeat } from "@/lib/types/transport";
import { cn } from "@/lib/utils";

const ACTOR = { name: "Transport Administrator", role: "Transport Administrator" };

function seatToneClass(seat: VehicleSeat): string {
  if (seat.studentId) return "border-info bg-info/10 text-info";
  if (seat.type === "unavailable") return "border-error/40 bg-error/10 text-error";
  if (seat.type === "reserved") return "border-warning/40 bg-warning/10 text-warning";
  if (seat.type === "wheelchair" || seat.type === "attendant" || seat.type === "emergency-exit") return "border-primary/40 bg-primary/5 text-primary";
  return "border-border bg-surface text-muted-foreground";
}

/** A functional, data-driven seat layout — never a decorative bus interior.
 * Every cell reflects real occupancy/reservation state and is clickable for
 * the assign/move/reserve/block/clear actions. A plain list view is always
 * available as a fallback (spec: always provide list fallback). */
export function VehicleSeatChart({ vehicle }: { vehicle: Vehicle }) {
  const db = useSisStore();
  const seats = db.vehicleSeats.filter((s) => s.vehicleId === vehicle.id);
  const [view, setView] = useState<"chart" | "list">("chart");
  const [selected, setSelected] = useState<VehicleSeat | null>(null);
  const [moveTargetId, setMoveTargetId] = useState("");
  const [assignStudentId, setAssignStudentId] = useState("");

  const rows = Math.max(0, ...seats.map((s) => s.row));
  const cols = Math.max(0, ...seats.map((s) => s.column));

  function studentName(id?: string) {
    if (!id) return undefined;
    const student = db.students.find((s) => s.id === id);
    return student ? `${student.profile.firstName} ${student.profile.lastName}` : id;
  }

  const emptyStandardSeats = seats.filter((s) => s.type === "standard" && !s.studentId && s.id !== selected?.id);
  const routeForVehicle = db.transportRoutes.find((r) => r.assignedVehicleId === vehicle.id);
  const eligibleStudents = db.studentTransportAssignments.filter((a) => a.vehicleId === vehicle.id && a.status === "active" && !a.seatId).map((a) => a.studentId);

  return (
    <div className="flex flex-col gap-sm">
      <div className="flex items-center justify-between gap-xs">
        <div className="flex items-center gap-1 rounded-md bg-surface-secondary p-1">
          <button type="button" onClick={() => setView("chart")} className={cn("min-h-8 rounded-md px-sm text-xs font-medium transition-colors", view === "chart" ? "bg-surface shadow-card text-foreground" : "text-muted-foreground")}>
            Chart
          </button>
          <button type="button" onClick={() => setView("list")} className={cn("flex min-h-8 items-center gap-1 rounded-md px-sm text-xs font-medium transition-colors", view === "list" ? "bg-surface shadow-card text-foreground" : "text-muted-foreground")}>
            <List className="size-3.5" /> List
          </button>
        </div>
        <Button size="sm" variant="outline" onClick={() => window.print()}>
          <Printer className="size-3.5" />
          Print seating chart
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-sm text-xs text-muted-foreground">
        <LegendDot className="border-border bg-surface" label="Available" />
        <LegendDot className="border-info bg-info/10" label="Occupied" />
        <LegendDot className="border-warning/40 bg-warning/10" label="Reserved" />
        <LegendDot className="border-error/40 bg-error/10" label="Blocked" />
        <LegendDot className="border-primary/40 bg-primary/5" label="Special" />
      </div>

      {view === "chart" ? (
        <div className="overflow-x-auto rounded-lg border border-border p-sm">
          <div className="inline-grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
            {Array.from({ length: rows }, (_, rowIndex) =>
              Array.from({ length: cols }, (_, colIndex) => {
                const seat = seats.find((s) => s.row === rowIndex + 1 && s.column === colIndex + 1);
                if (!seat) return <div key={`${rowIndex}-${colIndex}`} />;
                return (
                  <button
                    key={seat.id}
                    type="button"
                    onClick={() => {
                      setSelected(seat);
                      setMoveTargetId("");
                      setAssignStudentId("");
                    }}
                    className={cn("flex size-12 flex-col items-center justify-center rounded-md border text-[10px] font-medium transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring", seatToneClass(seat))}
                    title={seat.studentId ? studentName(seat.studentId) : seatTypeLabels[seat.type]}
                    aria-label={`Seat ${seat.seatNumber}, ${seatTypeLabels[seat.type]}${seat.studentId ? `, assigned to ${studentName(seat.studentId)}` : ""}`}
                  >
                    <span>{seat.seatNumber}</span>
                  </button>
                );
              }),
            )}
          </div>
        </div>
      ) : (
        <ul className="flex flex-col gap-1">
          {seats.map((seat) => (
            <li key={seat.id} className="flex items-center justify-between rounded-md border border-border px-sm py-1.5 text-sm">
              <span className="text-foreground">
                Seat {seat.seatNumber} · {seatTypeLabels[seat.type]}
              </span>
              <span className="text-xs text-muted-foreground">{studentName(seat.studentId) ?? "—"}</span>
            </li>
          ))}
        </ul>
      )}

      <DetailDrawer open={!!selected} onOpenChange={(open) => !open && setSelected(null)} title={selected ? `Seat ${selected.seatNumber}` : ""} description={selected ? seatTypeLabels[selected.type] : undefined}>
        {selected && (
          <div className="flex flex-col gap-sm">
            {selected.studentId ? (
              <>
                <p className="text-sm text-foreground">
                  Assigned to <span className="font-medium">{studentName(selected.studentId)}</span>
                </p>
                <div>
                  <Select value={moveTargetId} onValueChange={setMoveTargetId}>
                    <SelectTrigger aria-label="Move to seat">
                      <SelectValue placeholder="Move to an empty seat" />
                    </SelectTrigger>
                    <SelectContent>
                      {emptyStandardSeats.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          Seat {s.seatNumber}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    className="mt-xs w-full"
                    disabled={!moveTargetId}
                    onClick={() => {
                      moveStudentSeat(selected.id, moveTargetId, ACTOR);
                      setSelected(null);
                    }}
                  >
                    Move student
                  </Button>
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    clearSeat(selected.id, ACTOR);
                    setSelected(null);
                  }}
                >
                  Clear assignment
                </Button>
              </>
            ) : selected.type === "unavailable" || selected.type === "reserved" ? (
              <Button
                size="sm"
                onClick={() => {
                  clearSeat(selected.id, ACTOR);
                  setSelected(null);
                }}
              >
                Clear seat
              </Button>
            ) : (
              <>
                <div>
                  <Select value={assignStudentId} onValueChange={setAssignStudentId}>
                    <SelectTrigger aria-label="Assign student">
                      <SelectValue placeholder="Assign an unseated student" />
                    </SelectTrigger>
                    <SelectContent>
                      {eligibleStudents.map((studentId) => (
                        <SelectItem key={studentId} value={studentId}>
                          {studentName(studentId)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    className="mt-xs w-full"
                    disabled={!assignStudentId}
                    onClick={() => {
                      assignStudentToSeat(selected.id, assignStudentId, routeForVehicle?.id ?? "", ACTOR);
                      setSelected(null);
                    }}
                  >
                    Assign student
                  </Button>
                </div>
                <div className="flex items-center gap-xs">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      reserveSeat(selected.id, ACTOR);
                      setSelected(null);
                    }}
                  >
                    Reserve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      blockSeat(selected.id, ACTOR);
                      setSelected(null);
                    }}
                  >
                    Block
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={cn("size-2.5 rounded-sm border", className)} />
      {label}
    </span>
  );
}
