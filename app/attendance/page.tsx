"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, CalendarClock, ClipboardCheck, Settings2, TrendingDown, UserCog, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatTile } from "@/components/ui/stat-tile";
import { Switch } from "@/components/ui/switch";
import { usePermissions } from "@/components/providers/permissions-provider";
import { schoolClasses } from "@/lib/data/seed/reference";
import { consecutiveAbsenceStudents, lateArrivalCount, presentPercentFor, unmarkedSectionsToday } from "@/lib/selectors/attendance-insights";
import { useAttendanceRules, useAttendanceSessions } from "@/lib/hooks/use-attendance";
import { updateAttendanceRule } from "@/lib/services/attendance-service";
import { useSisStore } from "@/lib/hooks/use-store";

export default function AttendanceHubPage() {
  const sessions = useAttendanceSessions();
  const rules = useAttendanceRules();
  const db = useSisStore();
  const { can } = usePermissions();
  const [rulesOpen, setRulesOpen] = useState(false);

  const allSectionIds = schoolClasses.flatMap((c) => c.sections.map((s) => s.id));
  const unmarked = unmarkedSectionsToday(allSectionIds, sessions);
  const minPercentRule = rules.find((r) => r.key === "minAttendancePercent")?.value ?? 75;
  const consecutiveRule = rules.find((r) => r.key === "consecutiveAbsenceAlert")?.value ?? 3;
  const riskStudents = consecutiveAbsenceStudents(sessions, consecutiveRule);
  const belowMinCount = db.students.filter((s) => s.status === "active" && s.attendance.presentPercent < minPercentRule).length;

  return (
    <div className="flex flex-col gap-md">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Attendance</h1>
          <p className="text-xs text-muted-foreground">School-wide attendance overview</p>
        </div>
        <div className="flex flex-wrap gap-xs">
          {can("attendance.configureRules") && (
            <Button size="sm" variant="outline" onClick={() => setRulesOpen(true)}>
              <Settings2 className="size-3.5" />
              Rules
            </Button>
          )}
          <Button asChild size="sm" variant="outline">
            <Link href="/attendance/reports">Reports</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/attendance/students">Mark attendance</Link>
          </Button>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Present today" value={`${presentPercentFor(sessions.filter((s) => s.date.slice(0, 10) === new Date().toISOString().slice(0, 10)))}%`} icon={ClipboardCheck} tone="success" />
        <StatTile label="Late arrivals" value={String(lateArrivalCount(sessions))} icon={CalendarClock} tone="warning" />
        <StatTile label="Below minimum" value={String(belowMinCount)} icon={TrendingDown} tone="error" hint={`< ${minPercentRule}%`} />
        <StatTile label="Consecutive-absence risk" value={String(riskStudents.size)} icon={AlertTriangle} tone="error" />
      </section>

      <div className="grid grid-cols-1 gap-md sm:grid-cols-3">
        <Link href="/attendance/students" className="rounded-lg border border-border bg-surface p-sm hover:bg-surface-secondary/60">
          <Users className="mb-1 size-5 text-info" />
          <p className="text-sm font-medium text-foreground">Student attendance</p>
          <p className="text-xs text-muted-foreground">Mark daily or period attendance</p>
        </Link>
        <Link href="/attendance/staff" className="rounded-lg border border-border bg-surface p-sm hover:bg-surface-secondary/60">
          <UserCog className="mb-1 size-5 text-info" />
          <p className="text-sm font-medium text-foreground">Staff attendance</p>
          <p className="text-xs text-muted-foreground">Check-in status and corrections</p>
        </Link>
        <Link href="/attendance/leave" className="rounded-lg border border-border bg-surface p-sm hover:bg-surface-secondary/60">
          <CalendarClock className="mb-1 size-5 text-info" />
          <p className="text-sm font-medium text-foreground">Leave management</p>
          <p className="text-xs text-muted-foreground">Requests and approvals</p>
        </Link>
      </div>

      {unmarked.length > 0 && (
        <div className="flex flex-wrap items-center gap-sm rounded-lg border border-warning/30 bg-warning/10 px-sm py-sm text-xs text-warning">
          <AlertTriangle className="size-4 shrink-0" />
          <span className="font-medium">{unmarked.length} section(s) haven&apos;t marked attendance today.</span>
        </div>
      )}

      <DetailDrawer open={rulesOpen} onOpenChange={setRulesOpen} title="Attendance rules" description="Configure thresholds used across alerts and reports">
        <div className="flex flex-col gap-md">
          {rules.map((rule) => (
            <div key={rule.id} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{rule.label}</p>
                <p className="text-xs text-muted-foreground">{rule.description}</p>
              </div>
              <div className="flex shrink-0 items-center gap-xs">
                <Input type="number" value={rule.value} onChange={(e) => updateAttendanceRule(rule.id, { value: Number(e.target.value) })} className="w-16" />
                <span className="text-xs text-muted-foreground">{rule.unit}</span>
                <Switch checked={rule.enabled} onCheckedChange={(checked) => updateAttendanceRule(rule.id, { enabled: checked })} />
              </div>
            </div>
          ))}
          <Label className="text-xs text-muted-foreground">Changes apply immediately across attendance alerts and reports.</Label>
        </div>
      </DetailDrawer>
    </div>
  );
}
