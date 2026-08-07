"use client";

import Link from "next/link";
import { CalendarClock, HandHeart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/ui/stat-tile";
import { PrivacyNotice } from "@/components/campus/privacy";
import { PermissionDenied } from "@/components/library/permission-denied";
import { useShell } from "@/components/shell/shell-context";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { counsellingStatusLabels, counsellingStatusTone } from "@/lib/types/health";
import { formatDate } from "@/lib/utils";

export default function CounsellingDashboardPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const { activeSession } = useShell();
  if (!can("counselling.view")) return <PermissionDenied action="view the counselling dashboard" role={roleLabels[role]} backHref="/counselling" />;
  const canPrivate = can("counselling.private");

  const today = new Date().toISOString().slice(0, 10);
  const todays = db.counsellingAppointments.filter((a) => a.date === today);
  const upcoming = db.counsellingAppointments.filter((a) => a.date > today && (a.status === "scheduled" || a.status === "requested")).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).slice(0, 8);
  const followUps = db.counsellingAppointments.filter((a) => a.status === "follow-up").length;
  const studentName = (id: string) => { const s = db.students.find((x) => x.id === id); return s ? `${s.profile.firstName} ${s.profile.lastName}` : id; };

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="text-lg font-semibold text-foreground">Counselling Command Centre</h1><p className="text-xs text-muted-foreground">Administrative overview · {activeSession}</p></div>
      <PrivacyNotice kind="counselling" />
      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Today" value={String(todays.length)} icon={CalendarClock} tone="neutral" />
        <StatTile label="Upcoming" value={String(upcoming.length)} tone="info" />
        <StatTile label="Follow-ups" value={String(followUps)} icon={HandHeart} tone="info" />
        <StatTile label="Resources" value={String(db.counsellingResources.length)} tone="neutral" />
      </div>
      <div className="rounded-lg border border-border bg-surface p-md">
        <div className="mb-sm flex items-center justify-between"><h2 className="text-sm font-semibold text-foreground">Upcoming appointments</h2><Link href="/counselling/appointments" className="text-xs text-primary">All →</Link></div>
        {upcoming.length === 0 ? <p className="py-md text-center text-sm text-muted-foreground">No upcoming appointments.</p> : (
          <div className="flex flex-col gap-xs">{upcoming.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm">
              <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{canPrivate ? studentName(a.studentId) : "Student — approved appointment"}</p><p className="truncate text-xs text-muted-foreground">{formatDate(a.date)} {a.time} · {a.counsellorName}{canPrivate ? ` · ${a.adminReasonCategory}` : ""}</p></div>
              <Badge tone={counsellingStatusTone[a.status]}>{counsellingStatusLabels[a.status]}</Badge>
            </div>
          ))}</div>
        )}
      </div>
      {!canPrivate && <p className="text-xs text-muted-foreground">You can see scheduling availability only. Private counselling content is restricted to counsellors.</p>}
    </div>
  );
}
