"use client";

import { useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatTile } from "@/components/ui/stat-tile";
import { useSisStore } from "@/lib/hooks/use-store";
import { attendanceForDate, routeAttendanceSummary, stopAttendanceSummary } from "@/lib/selectors/transport-attendance-insights";
import { dropStatusLabels, pickupStatusLabels, type DropStatus, type PickupStatus } from "@/lib/types/transport";

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

export default function TransportAttendancePage() {
  const db = useSisStore();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [view, setView] = useState<"route" | "stop" | "student">("route");

  const routeSummary = routeAttendanceSummary(db, date).filter((r) => r.expected > 0);
  const stopSummary = stopAttendanceSummary(db, date);
  const studentRows = attendanceForDate(db, date);

  const totalExpected = studentRows.length;
  const totalBoarded = studentRows.filter((a) => a.pickupStatus === "boarded" || a.pickupStatus === "alternate-pickup").length;
  const totalMissed = studentRows.filter((a) => a.pickupStatus === "missed").length;

  function studentName(id: string) {
    const student = db.students.find((s) => s.id === id);
    return student ? `${student.profile.firstName} ${student.profile.lastName}` : id;
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Transport attendance</h1>
          <p className="text-xs text-muted-foreground">Boarding and drop attendance by route, stop or student</p>
        </div>
        <div className="w-40">
          <Label htmlFor="att-date" className="sr-only">
            Date
          </Label>
          <Input id="att-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-sm">
        <StatTile label="Expected" value={String(totalExpected)} tone="neutral" />
        <StatTile label="Boarded" value={String(totalBoarded)} tone="success" />
        <StatTile label="Missed" value={String(totalMissed)} tone={totalMissed > 0 ? "error" : "success"} />
      </div>

      <div className="flex items-center gap-1 rounded-md bg-surface-secondary p-1">
        {(["route", "stop", "student"] as const).map((v) => (
          <button key={v} type="button" onClick={() => setView(v)} className={`min-h-8 flex-1 rounded-md px-sm text-xs font-medium capitalize transition-colors ${view === v ? "bg-surface shadow-card text-foreground" : "text-muted-foreground"}`}>
            {v}
          </button>
        ))}
      </div>

      {view === "route" && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[400px] text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="p-xs text-left">Route</th>
                <th className="p-xs text-right">Expected</th>
                <th className="p-xs text-right">Boarded</th>
                <th className="p-xs text-right">Dropped</th>
                <th className="p-xs text-right">Missed</th>
              </tr>
            </thead>
            <tbody>
              {routeSummary.map((r) => (
                <tr key={r.routeId} className="border-t border-border">
                  <td className="p-xs text-foreground">{r.routeName}</td>
                  <td className="p-xs text-right text-muted-foreground">{r.expected}</td>
                  <td className="p-xs text-right text-success">{r.boarded}</td>
                  <td className="p-xs text-right text-foreground">{r.dropped}</td>
                  <td className="p-xs text-right text-error">{r.missed}</td>
                </tr>
              ))}
              {routeSummary.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-md text-center text-muted-foreground">
                    No trips recorded for this date.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {view === "stop" && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[360px] text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="p-xs text-left">Stop</th>
                <th className="p-xs text-right">Expected</th>
                <th className="p-xs text-right">Boarded</th>
                <th className="p-xs text-right">Missed</th>
              </tr>
            </thead>
            <tbody>
              {stopSummary.map((s) => (
                <tr key={s.stopId} className="border-t border-border">
                  <td className="p-xs text-foreground">{s.stopName}</td>
                  <td className="p-xs text-right text-muted-foreground">{s.expected}</td>
                  <td className="p-xs text-right text-success">{s.boarded}</td>
                  <td className="p-xs text-right text-error">{s.missed}</td>
                </tr>
              ))}
              {stopSummary.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-md text-center text-muted-foreground">
                    No stop activity for this date.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {view === "student" && (
        <ul className="flex flex-col gap-1">
          {studentRows.map((row) => (
            <li key={row.id} className="flex items-center justify-between rounded-md border border-border px-sm py-2 text-sm">
              <span className="text-foreground">{studentName(row.studentId)}</span>
              <div className="flex items-center gap-1">
                <Badge tone={pickupTone[row.pickupStatus]}>{pickupStatusLabels[row.pickupStatus]}</Badge>
                <Badge tone={dropTone[row.dropStatus]}>{dropStatusLabels[row.dropStatus]}</Badge>
              </div>
            </li>
          ))}
          {studentRows.length === 0 && (
            <li className="flex flex-col items-center gap-xs rounded-lg border border-dashed border-border p-lg text-center">
              <ClipboardCheck className="size-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No attendance recorded for this date.</p>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
