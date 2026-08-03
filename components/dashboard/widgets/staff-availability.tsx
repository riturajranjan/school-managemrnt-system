"use client";

import { Users } from "lucide-react";
import type { StaffStatus } from "../data/types";
import { fetchStaffAvailability } from "../data/mock-data";
import { toneClasses } from "../tone";
import { useWidgetData } from "../use-widget-data";
import { WidgetShell } from "../widget-shell";

const STATUS_LABEL: Record<StaffStatus, string> = {
  in: "In",
  out: "Out",
  leave: "Leave",
  late: "Late",
};

const STATUS_TONE: Record<StaffStatus, keyof typeof toneClasses> = {
  in: "success",
  out: "neutral",
  leave: "warning",
  late: "error",
};

export function StaffAvailabilityWidget() {
  const state = useWidgetData(fetchStaffAvailability);

  return (
    <WidgetShell
      title="Staff Availability"
      icon={Users}
      status={state.status}
      error={state.status === "error" ? state.error : undefined}
      onRetry={state.retry}
      isEmpty={state.status === "ready" && state.data.totalStaff === 0}
      emptyMessage="No staff roster data available."
    >
      {state.status === "ready" && (
        <div className="flex h-full flex-col gap-xs">
          <p className="text-sm text-foreground">
            <span className="font-semibold">{state.data.present}</span>
            <span className="text-muted-foreground"> / {state.data.totalStaff} present</span>
          </p>
          <ul className="flex flex-1 flex-col gap-0.5 overflow-hidden">
            {state.data.staff.slice(0, 4).map((member) => (
              <li key={member.id} className="flex items-center gap-xs">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-secondary text-[10px] font-semibold text-foreground">
                  {member.initials}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs text-foreground">{member.name}</span>
                <span className={`shrink-0 rounded-pill px-1.5 py-0.5 text-[10px] font-semibold ${toneClasses[STATUS_TONE[member.status]].soft}`}>
                  {STATUS_LABEL[member.status]}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </WidgetShell>
  );
}
