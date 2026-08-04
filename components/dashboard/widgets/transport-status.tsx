"use client";

import { Bus, MapPinned, Wrench } from "lucide-react";
import { useState } from "react";
import type { TransportRouteStatus } from "../data/types";
import { fetchTransportStatus } from "../data/mock-data";
import { DetailDrawer } from "../detail-drawer";
import { toneClasses } from "../tone";
import { useWidgetData } from "../use-widget-data";
import { WidgetShell, widgetActionButtonClass } from "../widget-shell";

const STATUS_LABEL: Record<TransportRouteStatus, string> = {
  "on-time": "On time",
  delayed: "Delayed",
  issue: "Issue",
  completed: "Completed",
};

const STATUS_TONE: Record<TransportRouteStatus, keyof typeof toneClasses> = {
  "on-time": "success",
  delayed: "warning",
  issue: "error",
  completed: "neutral",
};

export function TransportStatusWidget() {
  const state = useWidgetData(fetchTransportStatus);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const activeBuses = state.status === "ready" ? state.data.routes.filter((r) => r.status !== "completed").length : 0;
  const delayedBuses = state.status === "ready" ? state.data.routes.filter((r) => r.status === "delayed" || r.status === "issue").length : 0;
  const completedRoutes = state.status === "ready" ? state.data.routes.filter((r) => r.status === "completed").length : 0;

  return (
    <>
      <WidgetShell
        title="Transport Status"
        icon={Bus}
        status={state.status}
        error={state.status === "error" ? state.error : undefined}
        onRetry={state.retry}
        isEmpty={state.status === "ready" && state.data.routes.length === 0}
        emptyMessage="No active routes right now."
        action={
          state.status === "ready" ? (
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className={widgetActionButtonClass}
            >
              <MapPinned className="size-3.5" aria-hidden="true" />
              Open tracking
            </button>
          ) : undefined
        }
      >
        {state.status === "ready" && (
          <div className="flex h-full flex-col gap-sm">
            <dl className="grid grid-cols-3 gap-xs text-center">
              <div>
                <dt className="text-xs text-muted-foreground">Active</dt>
                <dd className="text-sm font-semibold text-foreground">{activeBuses}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Delayed</dt>
                <dd className="text-sm font-semibold text-warning">{delayedBuses}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Completed</dt>
                <dd className="text-sm font-semibold text-foreground">{completedRoutes}</dd>
              </div>
            </dl>

            {state.data.maintenanceAlerts.length > 0 && (
              <div className="flex items-center gap-xs rounded-md bg-error/15 px-sm py-xs text-xs font-medium text-error">
                <Wrench className="size-3.5 shrink-0" aria-hidden="true" />
                {state.data.maintenanceAlerts.length} maintenance alert{state.data.maintenanceAlerts.length > 1 ? "s" : ""}
              </div>
            )}

            <ul className="flex flex-1 flex-col gap-1 overflow-hidden">
              {state.data.routes.slice(0, 4).map((route) => (
                <li key={route.id} className="flex items-center gap-xs">
                  <span className={`size-1.5 shrink-0 rounded-full ${toneClasses[STATUS_TONE[route.status]].dot}`} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-xs text-foreground">{route.name}</span>
                  <span className={`shrink-0 text-xs font-medium ${toneClasses[STATUS_TONE[route.status]].text}`}>
                    {STATUS_LABEL[route.status]}
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
        title="Live transport tracking"
        description="Route status, ETA, and maintenance alerts for every active bus."
      >
        {state.status === "ready" && (
          <div className="flex flex-col gap-lg">
            <div>
              <p className="mb-xs text-xs font-semibold uppercase tracking-wide text-muted-foreground">Routes</p>
              <ul className="flex flex-col gap-xs">
                {state.data.routes.map((route) => (
                  <li key={route.id} className="rounded-md border border-border p-sm">
                    <div className="flex items-center justify-between gap-xs">
                      <span className="text-sm font-medium text-foreground">{route.name}</span>
                      <span className={`rounded-pill px-1.5 py-0.5 text-xs font-semibold ${toneClasses[STATUS_TONE[route.status]].soft}`}>
                        {STATUS_LABEL[route.status]}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {route.status === "completed"
                        ? "Route completed"
                        : `ETA ${route.etaMinutes} min · ${route.studentsOnboard} students onboard`}
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            {state.data.maintenanceAlerts.length > 0 && (
              <div>
                <p className="mb-xs text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Maintenance alerts
                </p>
                <ul className="flex flex-col gap-xs">
                  {state.data.maintenanceAlerts.map((alert) => (
                    <li key={alert.id} className="flex items-start gap-xs rounded-md bg-error/10 p-sm">
                      <Wrench className="mt-0.5 size-3.5 shrink-0 text-error" aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-foreground">{alert.busId}</span>
                        <span className="block text-xs text-muted-foreground">{alert.issue}</span>
                        <span className="block text-xs text-muted-foreground">{alert.reportedAgo}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </DetailDrawer>
    </>
  );
}
