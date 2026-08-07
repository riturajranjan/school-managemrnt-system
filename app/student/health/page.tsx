"use client";

import { CalendarClock, HeartPulse } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { formatDate } from "@/lib/utils";

export default function StudentHealthPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  if (!can("health.viewOwn") && !can("health.view")) return <PermissionDenied action="view your health information" role={roleLabels[role]} backHref="/" />;

  const me = db.students[0];
  const profile = me ? db.healthProfiles.find((p) => p.studentId === me.id) : undefined;
  const today = new Date().toISOString().slice(0, 10);
  const appointments = me ? db.healthAppointments.filter((a) => a.studentId === me.id && a.date >= today && a.status !== "completed") : [];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-sm"><span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary"><HeartPulse className="size-4" /></span><div><h1 className="text-lg font-semibold text-foreground">My health</h1><p className="text-xs text-muted-foreground">Your recorded information and upcoming visits</p></div></div>

      <div className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">On record</h2>
        {profile ? (
          <dl className="grid grid-cols-2 gap-sm text-sm">
            <div><dt className="text-xs text-muted-foreground">Blood group</dt><dd className="font-medium text-foreground">{profile.bloodGroup ?? "Not recorded"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Emergency contact</dt><dd className="font-medium text-foreground">{profile.emergencyContactName}</dd></div>
            <div className="col-span-2"><dt className="text-xs text-muted-foreground">Allergies</dt><dd className="font-medium text-foreground">{profile.allergies.length > 0 ? profile.allergies.join(", ") : "None recorded"}</dd></div>
            {profile.careInstructions && <div className="col-span-2"><dt className="text-xs text-muted-foreground">Care instructions</dt><dd className="font-medium text-foreground">{profile.careInstructions}</dd></div>}
          </dl>
        ) : <p className="text-sm text-muted-foreground">No health record on file.</p>}
      </div>

      <div className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm flex items-center gap-1 text-sm font-semibold text-foreground"><CalendarClock className="size-4" /> Upcoming visits</h2>
        {appointments.length === 0 ? <p className="py-md text-center text-sm text-muted-foreground">No upcoming health appointments.</p> : (
          <div className="flex flex-col gap-xs">{appointments.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm text-sm"><span className="text-foreground">{a.purpose} · {formatDate(a.date)} {a.time}</span><Badge tone="info">{a.status}</Badge></div>
          ))}</div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">This shows only information the school has recorded and is permitted to display to you.</p>
    </div>
  );
}
