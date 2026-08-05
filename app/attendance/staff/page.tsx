"use client";

import { useMemo, useState } from "react";
import { Clock, UserCheck, UserMinus, UserX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatTile } from "@/components/ui/stat-tile";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useStaffAttendance } from "@/lib/hooks/use-attendance";
import { correctAttendance } from "@/lib/services/staff-attendance-service";
import { staffAttendanceStatusTone, type StaffAttendance } from "@/lib/types/attendance";

export default function StaffAttendancePage() {
  const staffAttendance = useStaffAttendance();
  const { can } = usePermissions();
  const [correcting, setCorrecting] = useState<StaffAttendance | null>(null);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");

  const byDepartment = useMemo(() => {
    const map = new Map<string, StaffAttendance[]>();
    for (const a of staffAttendance) map.set(a.department, [...(map.get(a.department) ?? []), a]);
    return [...map.entries()];
  }, [staffAttendance]);

  if (!can("staffAttendance.view")) {
    return (
      <div className="flex flex-col items-center gap-sm py-2xl text-center">
        <UserX className="size-6 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">Staff attendance is restricted</p>
        <p className="max-w-xs text-xs text-muted-foreground">You don&apos;t have permission to view confidential staff attendance records.</p>
      </div>
    );
  }

  const present = staffAttendance.filter((a) => a.status === "present").length;
  const absent = staffAttendance.filter((a) => a.status === "absent").length;
  const onLeave = staffAttendance.filter((a) => a.status === "on-leave").length;
  const late = staffAttendance.filter((a) => a.status === "late").length;
  const notCheckedIn = staffAttendance.filter((a) => a.status === "not-checked-in").length;

  return (
    <div className="flex flex-col gap-md">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Staff attendance</h1>
        <p className="text-xs text-muted-foreground">Today&apos;s check-in status across departments</p>
      </div>

      <section className="grid grid-cols-2 gap-sm sm:grid-cols-5">
        <StatTile label="Present" value={String(present)} icon={UserCheck} tone="success" />
        <StatTile label="Absent" value={String(absent)} icon={UserX} tone="error" />
        <StatTile label="On leave" value={String(onLeave)} icon={UserMinus} tone="info" />
        <StatTile label="Late" value={String(late)} icon={Clock} tone="warning" />
        <StatTile label="Not checked in" value={String(notCheckedIn)} icon={UserX} tone="neutral" />
      </section>

      {byDepartment.map(([department, members]) => (
        <div key={department} className="rounded-lg border border-border bg-surface">
          <div className="border-b border-border p-sm">
            <h2 className="text-sm font-semibold text-foreground">{department}</h2>
          </div>
          <ul className="divide-y divide-border">
            {members.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-sm p-sm">
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">{m.staffName}</span>
                <span className="text-xs text-muted-foreground">{m.checkIn ? `In ${m.checkIn}` : "—"}</span>
                <span className="text-xs text-muted-foreground">{m.checkOut ? `Out ${m.checkOut}` : ""}</span>
                <Badge tone={staffAttendanceStatusTone[m.status]}>{m.status.replace("-", " ")}</Badge>
                {can("staffAttendance.manage") && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setCorrecting(m);
                      setCheckIn(m.checkIn ?? "");
                      setCheckOut(m.checkOut ?? "");
                    }}
                  >
                    Correct
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}

      <DetailDrawer open={correcting !== null} onOpenChange={(open) => !open && setCorrecting(null)} title="Correct attendance" description={correcting?.staffName}>
        <div className="flex flex-col gap-sm">
          <div>
            <Label htmlFor="correct-in">Check-in</Label>
            <Input id="correct-in" type="time" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="correct-out">Check-out</Label>
            <Input id="correct-out" type="time" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
          </div>
          <Button
            onClick={() => {
              if (correcting) correctAttendance(correcting.staffId, { checkIn, checkOut, status: "present" }, "Administrator");
              setCorrecting(null);
            }}
          >
            Save correction
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
