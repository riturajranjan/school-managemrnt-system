"use client";

import { Users, UserSearch } from "lucide-react";
import { useState } from "react";
import type { StaffStatus, SubstituteRequirementStatus } from "../data/types";
import { fetchStaffAvailability } from "../data/mock-data";
import { DetailDrawer } from "../detail-drawer";
import { toneClasses } from "../tone";
import { useWidgetData } from "../use-widget-data";
import { WidgetShell, widgetActionButtonClass } from "../widget-shell";

const STATUS_LABEL: Record<StaffStatus, string> = {
  in: "In",
  absent: "Absent",
  leave: "Leave",
  late: "Late",
};

const STATUS_TONE: Record<StaffStatus, keyof typeof toneClasses> = {
  in: "success",
  absent: "error",
  leave: "warning",
  late: "warning",
};

const SUB_STATUS_LABEL: Record<SubstituteRequirementStatus, string> = {
  unfilled: "Unfilled",
  assigned: "Assigned",
};

const SUB_STATUS_TONE: Record<SubstituteRequirementStatus, keyof typeof toneClasses> = {
  unfilled: "error",
  assigned: "success",
};

export function StaffAvailabilityWidget() {
  const state = useWidgetData(fetchStaffAvailability);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const unfilledCount =
    state.status === "ready" ? state.data.substituteRequirements.filter((r) => r.status === "unfilled").length : 0;

  return (
    <>
      <WidgetShell
        title="Staff Availability"
        icon={Users}
        status={state.status}
        error={state.status === "error" ? state.error : undefined}
        onRetry={state.retry}
        isEmpty={state.status === "ready" && state.data.totalStaff === 0}
        emptyMessage="No staff roster data available."
        action={
          state.status === "ready" ? (
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className={widgetActionButtonClass}
            >
              <UserSearch className="size-3.5" aria-hidden="true" />
              View staff
            </button>
          ) : undefined
        }
      >
        {state.status === "ready" && (
          <div className="flex h-full flex-col gap-sm">
            <dl className="grid grid-cols-3 gap-xs text-center">
              <div>
                <dt className="text-xs text-muted-foreground">Present</dt>
                <dd className="text-sm font-semibold text-success">{state.data.present}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Absent</dt>
                <dd className="text-sm font-semibold text-error">{state.data.absent}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">On leave</dt>
                <dd className="text-sm font-semibold text-warning">{state.data.onLeave}</dd>
              </div>
            </dl>

            {state.data.substituteRequirements.length > 0 && (
              <div className="flex items-center justify-between rounded-md bg-surface-secondary px-sm py-xs text-xs">
                <span className="text-muted-foreground">Substitute coverage</span>
                <span className={unfilledCount > 0 ? "font-semibold text-error" : "font-semibold text-success"}>
                  {unfilledCount > 0
                    ? `${unfilledCount} unfilled`
                    : `${state.data.substituteRequirements.length} assigned`}
                </span>
              </div>
            )}

            <ul className="flex flex-1 flex-col gap-0.5 overflow-hidden">
              {state.data.staff.slice(0, 4).map((member) => (
                <li key={member.id} className="flex items-center gap-xs">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-secondary text-xs font-semibold text-foreground">
                    {member.initials}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs text-foreground">{member.name}</span>
                  <span className={`shrink-0 rounded-pill px-1.5 py-0.5 text-xs font-semibold ${toneClasses[STATUS_TONE[member.status]].soft}`}>
                    {STATUS_LABEL[member.status]}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </WidgetShell>

      <DetailDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title="Staff roster"
        description="Full staff attendance status and substitute coverage requirements."
      >
        {state.status === "ready" && (
          <div className="flex flex-col gap-lg">
            <div>
              <p className="mb-xs text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Substitute requirements
              </p>
              <ul className="flex flex-col gap-xs">
                {state.data.substituteRequirements.map((req) => (
                  <li key={req.id} className="rounded-md border border-border p-sm">
                    <div className="flex items-center justify-between gap-xs">
                      <span className="text-sm font-medium text-foreground">
                        {req.className} · {req.subject}
                      </span>
                      <span className={`rounded-pill px-1.5 py-0.5 text-xs font-semibold ${toneClasses[SUB_STATUS_TONE[req.status]].soft}`}>
                        {SUB_STATUS_LABEL[req.status]}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Covering for {req.coveringFor}
                      {req.substituteName ? ` · assigned to ${req.substituteName}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="mb-xs text-xs font-semibold uppercase tracking-wide text-muted-foreground">Full roster</p>
              <ul className="flex flex-col gap-0.5">
                {state.data.staff.map((member) => (
                  <li key={member.id} className="flex items-center gap-sm border-b border-border py-xs">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-secondary text-xs font-semibold text-foreground">
                      {member.initials}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-foreground">{member.name}</span>
                      <span className="block text-xs text-muted-foreground">{member.role}</span>
                    </span>
                    <span className={`shrink-0 rounded-pill px-1.5 py-0.5 text-xs font-semibold ${toneClasses[STATUS_TONE[member.status]].soft}`}>
                      {STATUS_LABEL[member.status]}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </DetailDrawer>
    </>
  );
}
