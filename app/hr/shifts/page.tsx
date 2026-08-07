"use client";

import { CalendarClock, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";

export default function ShiftsPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  if (!can("hr.view")) return <PermissionDenied action="view shifts" role={roleLabels[role]} backHref="/hr" />;

  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Shifts</h1>
        <p className="text-xs text-muted-foreground">Shift definitions, timings and applicable days</p>
      </div>

      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
        {db.shifts.map((s) => (
          <div key={s.id} className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
            <div className="flex items-center justify-between gap-sm">
              <div className="flex items-center gap-sm">
                <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary"><CalendarClock className="size-4" /></span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{s.name} <span className="text-xs text-muted-foreground">{s.code}</span></p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="size-3" /> {s.startTime}–{s.endTime}</p>
                </div>
              </div>
              <Badge tone={s.status === "active" ? "success" : "neutral"}>{s.status}</Badge>
            </div>
            <div className="grid grid-cols-3 gap-sm text-center text-xs">
              <Chip label="Break" value={`${s.breakMinutes}m`} />
              <Chip label="Grace" value={`${s.graceMinutes}m`} />
              <Chip label="Half-day" value={`${s.halfDayThresholdHours}h`} />
            </div>
            <div className="flex flex-wrap gap-1">
              {weekDays.map((d) => (
                <span key={d} className={`rounded-pill px-2 py-0.5 text-[11px] font-medium ${s.days.includes(d) ? "bg-primary/10 text-primary" : "bg-surface-secondary text-muted-foreground line-through"}`}>{d}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-sm">
      <p className="text-muted-foreground">{label}</p>
      <p className="font-semibold text-foreground">{value}</p>
    </div>
  );
}
