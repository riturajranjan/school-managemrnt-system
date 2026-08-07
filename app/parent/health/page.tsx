"use client";

import { HeartPulse } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { formatDate } from "@/lib/utils";

export default function ParentHealthPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  if (!can("health.viewOwn") && !can("health.view")) return <PermissionDenied action="view your child's health notices" role={roleLabels[role]} backHref="/" />;

  const child = db.students[0];
  const profile = child ? db.healthProfiles.find((p) => p.studentId === child.id) : undefined;
  const today = new Date().toISOString().slice(0, 10);
  const appointments = child ? db.healthAppointments.filter((a) => a.studentId === child.id && a.date >= today && a.status !== "completed") : [];
  const incidents = child ? db.healthIncidents.filter((i) => i.studentId === child.id && i.guardianContacted) : [];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-sm"><span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary"><HeartPulse className="size-4" /></span><div><h1 className="text-lg font-semibold text-foreground">Health — {child?.profile.firstName}</h1><p className="text-xs text-muted-foreground">Administrative notices the school shares with you</p></div></div>

      <div className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">On record</h2>
        {profile ? (
          <dl className="grid grid-cols-2 gap-sm text-sm">
            <div><dt className="text-xs text-muted-foreground">Blood group</dt><dd className="font-medium text-foreground">{profile.bloodGroup ?? "Not recorded"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Emergency contact</dt><dd className="font-medium text-foreground">{profile.emergencyContactName}</dd></div>
            <div className="col-span-2"><dt className="text-xs text-muted-foreground">Allergies on file</dt><dd className="font-medium text-foreground">{profile.allergies.length > 0 ? profile.allergies.join(", ") : "None recorded"}</dd></div>
          </dl>
        ) : <p className="text-sm text-muted-foreground">No health record on file.</p>}
        <p className="mt-2 text-xs text-muted-foreground">To update these details, contact the infirmary.</p>
      </div>

      <div className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">Notices & appointments</h2>
        {appointments.length === 0 && incidents.length === 0 ? <p className="py-md text-center text-sm text-muted-foreground">No current notices.</p> : (
          <div className="flex flex-col gap-xs">
            {appointments.map((a) => <div key={a.id} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm text-sm"><span className="text-foreground">Appointment · {a.purpose} · {formatDate(a.date)}</span><Badge tone="info">{a.status}</Badge></div>)}
            {incidents.map((i) => <div key={i.id} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm text-sm"><span className="min-w-0 truncate text-foreground">You were contacted about an incident on {formatDate(i.occurredAt)}</span><Badge tone="warning">{i.status}</Badge></div>)}
          </div>
        )}
      </div>
    </div>
  );
}
