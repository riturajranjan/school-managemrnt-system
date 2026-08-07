"use client";

import { useState } from "react";
import { CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { appointmentTypeLabels } from "@/lib/types/communication";
import { formatDate } from "@/lib/utils";

export default function AppointmentsPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [tab, setTab] = useState<"today" | "upcoming" | "all">("today");
  const today = new Date().toISOString().slice(0, 10);

  if (!can("frontdesk.view")) return <PermissionDenied action="view appointments" role={roleLabels[role]} backHref="/front-desk" />;

  const rows = db.visitorAppointments
    .filter((a) => (tab === "today" ? a.date === today : tab === "upcoming" ? a.date >= today : true))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Appointments</h1>
          <p className="text-xs text-muted-foreground">Scheduled visitor meetings</p>
        </div>
        <div className="inline-flex rounded-md border border-border p-0.5">
          {(["today", "upcoming", "all"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`rounded px-sm py-1.5 text-xs font-medium capitalize ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{t}</button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
          <CalendarClock className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No appointments in this view.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-sm">
          {rows.map((a) => (
            <div key={a.id} className="flex items-center gap-sm rounded-lg border border-border bg-surface p-sm">
              <div className="flex w-16 shrink-0 flex-col items-center rounded-md bg-primary/10 py-1 text-primary">
                <span className="text-xs font-bold">{a.time}</span>
                <span className="text-[10px]">{formatDate(a.date, { day: "2-digit", month: "short" })}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{a.visitorName} · {appointmentTypeLabels[a.type]}</p>
                <p className="truncate text-xs text-muted-foreground">Host {a.hostName} · {a.location} · {a.durationMinutes} min</p>
              </div>
              <Badge tone={a.status === "completed" ? "success" : a.status === "confirmed" ? "info" : a.status === "cancelled" || a.status === "no-show" ? "neutral" : "warning"}>{a.status}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
