"use client";

import { useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useTransportAttendance } from "@/lib/hooks/api/use-transport-api";
import { roleLabels } from "@/lib/permissions/roles";
import type { TransportBoardingStatusDto, TransportDropStatusDto } from "@/lib/api/contracts";

const boardingTone: Record<TransportBoardingStatusDto, "success" | "warning" | "error" | "neutral"> = { expected: "neutral", boarded: "success", absent: "error" };
const boardingLabel: Record<TransportBoardingStatusDto, string> = { expected: "Expected", boarded: "Boarded", absent: "Absent" };
const dropTone: Record<TransportDropStatusDto, "success" | "neutral"> = { onboard: "neutral", dropped: "success" };
const dropLabel: Record<TransportDropStatusDto, string> = { onboard: "Onboard", dropped: "Dropped" };

export default function TransportAttendancePage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [view, setView] = useState<"route" | "stop" | "student">("route");
  const { data, loading, error, reload } = useTransportAttendance(date);

  if (!capabilitiesLoading && !hasServerPermission("transport.view")) {
    return <PermissionDenied action="view transport attendance" role={roleLabels[role]} backHref="/transport" />;
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

      {error ? (
        <div className="rounded-lg border border-error/30 bg-error/5 p-md text-sm text-error" role="alert">
          Could not load attendance: {error}
          <Button variant="outline" size="sm" className="ml-sm" onClick={reload}>
            Retry
          </Button>
        </div>
      ) : loading && !data ? (
        <div className="rounded-lg border border-border bg-surface p-2xl text-center text-sm text-muted-foreground">Loading attendance…</div>
      ) : data ? (
        <>
          <div className="grid grid-cols-3 gap-sm">
            <StatTile label="Expected" value={String(data.expected)} tone="neutral" />
            <StatTile label="Boarded" value={String(data.boarded)} tone="success" />
            <StatTile label="Missed" value={String(data.missed)} tone={data.missed > 0 ? "error" : "success"} />
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
                    <th className="p-xs text-right">Absent</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byRoute.map((r) => (
                    <tr key={r.routeId} className="border-t border-border">
                      <td className="p-xs text-foreground">{r.routeName}</td>
                      <td className="p-xs text-right text-muted-foreground">{r.expected}</td>
                      <td className="p-xs text-right text-success">{r.boarded}</td>
                      <td className="p-xs text-right text-foreground">{r.dropped}</td>
                      <td className="p-xs text-right text-error">{r.absent}</td>
                    </tr>
                  ))}
                  {data.byRoute.length === 0 && (
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
                    <th className="p-xs text-right">Absent</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byStop.map((s) => (
                    <tr key={s.stopId} className="border-t border-border">
                      <td className="p-xs text-foreground">{s.stopName}</td>
                      <td className="p-xs text-right text-muted-foreground">{s.expected}</td>
                      <td className="p-xs text-right text-success">{s.boarded}</td>
                      <td className="p-xs text-right text-error">{s.absent}</td>
                    </tr>
                  ))}
                  {data.byStop.length === 0 && (
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
              {data.students.map((row) => (
                <li key={row.tripStudentId} className="flex items-center justify-between rounded-md border border-border px-sm py-2 text-sm">
                  <div>
                    <span className="text-foreground">{row.studentName}</span>
                    <span className="ml-xs text-xs text-muted-foreground">{row.routeName}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge tone={boardingTone[row.boardingStatus]}>{boardingLabel[row.boardingStatus]}</Badge>
                    <Badge tone={dropTone[row.dropStatus]}>{dropLabel[row.dropStatus]}</Badge>
                  </div>
                </li>
              ))}
              {data.students.length === 0 && (
                <li className="flex flex-col items-center gap-xs rounded-lg border border-dashed border-border p-lg text-center">
                  <ClipboardCheck className="size-5 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No attendance recorded for this date.</p>
                </li>
              )}
            </ul>
          )}
        </>
      ) : null}
    </div>
  );
}
