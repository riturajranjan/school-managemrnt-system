"use client";

// Real PostgreSQL/API cutover (Phase 9E.1) — reads the live
// GET /api/staff-attendance(+/summary) endpoints. A staff member with no
// record for today shows "not-marked", never a fake "absent".
import { useMemo, useState } from "react";
import { Clock, UserCheck, UserMinus, UserX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatTile } from "@/components/ui/stat-tile";
import { usePermissions } from "@/components/providers/permissions-provider";
import { markStaffAttendanceRequest, useStaffAttendanceRoster, useStaffAttendanceSummary } from "@/lib/hooks/api/use-staff-attendance-api";
import type { EffectiveStaffAttendanceStatusDto, StaffAttendanceRosterEntryDto } from "@/lib/api/contracts";

const statusTone: Record<EffectiveStaffAttendanceStatusDto, "success" | "warning" | "error" | "info" | "neutral"> = {
  present: "success", absent: "error", late: "warning", "half-day": "warning", "on-leave": "info", "not-marked": "neutral",
};
const statusLabel: Record<EffectiveStaffAttendanceStatusDto, string> = {
  present: "Present", absent: "Absent", late: "Late", "half-day": "Half day", "on-leave": "On leave", "not-marked": "Not marked",
};

export default function StaffAttendancePage() {
  const today = new Date().toISOString().slice(0, 10);
  const { data: roster, loading, error, reload } = useStaffAttendanceRoster(today);
  const { data: summary, reload: reloadSummary } = useStaffAttendanceSummary(today);
  const { can } = usePermissions();
  const [correcting, setCorrecting] = useState<StaffAttendanceRosterEntryDto | null>(null);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [saving, setSaving] = useState(false);

  const byDepartment = useMemo(() => {
    const map = new Map<string, StaffAttendanceRosterEntryDto[]>();
    for (const a of roster ?? []) {
      const key = a.department ?? "Unassigned";
      map.set(key, [...(map.get(key) ?? []), a]);
    }
    return [...map.entries()];
  }, [roster]);

  if (!can("staffAttendance.view")) {
    return (
      <div className="flex flex-col items-center gap-sm py-2xl text-center">
        <UserX className="size-6 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">
          Staff attendance is restricted
        </p>
        <p className=" text-xs text-muted-foreground">
          You don&apos;t have permission to view confidential staff attendance
          records.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-md">
      <div>
        <h1 className="text-lg font-semibold text-foreground">
          Staff attendance
        </h1>
        <p className="text-xs text-muted-foreground">
          Today&apos;s check-in status across departments
        </p>
      </div>

      {error && <p className="rounded-md border border-error/30 bg-error/8 p-sm text-sm text-error">{error}</p>}
      {loading && !roster && <p className="text-xs text-muted-foreground">Loading…</p>}

      {summary && (
        <section className="grid grid-cols-2 gap-sm sm:grid-cols-5">
          <StatTile label="Present" value={String(summary.present)} icon={UserCheck} tone="success" />
          <StatTile label="Absent" value={String(summary.absent)} icon={UserX} tone="error" />
          <StatTile label="On leave" value={String(summary.onLeave)} icon={UserMinus} tone="info" />
          <StatTile label="Late" value={String(summary.late)} icon={Clock} tone="warning" />
          <StatTile label="Not marked" value={String(summary.notMarked)} icon={UserX} tone="neutral" />
        </section>
      )}

      {roster && roster.length === 0 && !loading && (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No active staff found.</p>
      )}

      {byDepartment.map(([department, members]) => (
        <div
          key={department}
          className="rounded-lg border border-border bg-surface">
          <div className="border-b border-border p-sm">
            <h2 className="text-sm font-semibold text-foreground">
              {department}
            </h2>
          </div>
          <ul className="divide-y divide-border">
            {members.map((m) => (
              <li
                key={m.staffId}
                className="flex flex-wrap items-center gap-sm p-sm">
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                  {m.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {m.checkInAt ? `In ${m.checkInAt}` : "—"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {m.checkOutAt ? `Out ${m.checkOutAt}` : ""}
                </span>
                <Badge tone={statusTone[m.status]}>
                  {statusLabel[m.status]}
                </Badge>
                {can("staffAttendance.manage") && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setCorrecting(m);
                      setCheckIn(m.checkInAt ?? "");
                      setCheckOut(m.checkOutAt ?? "");
                    }}>
                    Correct
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}

      <DetailDrawer
        open={correcting !== null}
        onOpenChange={(open) => !open && setCorrecting(null)}
        title="Correct attendance"
        description={correcting?.name}>
        <div className="flex flex-col gap-sm">
          <div>
            <Label htmlFor="correct-in">Check-in</Label>
            <Input
              id="correct-in"
              type="time"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="correct-out">Check-out</Label>
            <Input
              id="correct-out"
              type="time"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
            />
          </div>
          <Button
            disabled={saving}
            onClick={async () => {
              if (!correcting) return;
              setSaving(true);
              const wasOnLeave = correcting.status === "on-leave";
              await markStaffAttendanceRequest({
                date: today,
                entries: [{ staffId: correcting.staffId, status: "present", checkInAt: checkIn || undefined, checkOutAt: checkOut || undefined, override: wasOnLeave }],
              });
              setSaving(false);
              setCorrecting(null);
              reload();
              reloadSummary();
            }}>
            Save correction
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
