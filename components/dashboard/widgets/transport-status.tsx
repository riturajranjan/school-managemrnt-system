"use client";

import { Bus } from "lucide-react";
import type { TransportRouteStatus } from "../data/types";
import { fetchTransportStatus } from "../data/mock-data";
import { toneClasses } from "../tone";
import { useWidgetData } from "../use-widget-data";
import { WidgetShell } from "../widget-shell";

const STATUS_LABEL: Record<TransportRouteStatus, string> = {
  "on-time": "On time",
  delayed: "Delayed",
  issue: "Issue",
};

const STATUS_TONE: Record<TransportRouteStatus, keyof typeof toneClasses> = {
  "on-time": "success",
  delayed: "warning",
  issue: "error",
};

export function TransportStatusWidget() {
  const state = useWidgetData(fetchTransportStatus);

  return (
    <WidgetShell
      title="Transport Status"
      icon={Bus}
      status={state.status}
      error={state.status === "error" ? state.error : undefined}
      onRetry={state.retry}
      isEmpty={state.status === "ready" && state.data.routes.length === 0}
      emptyMessage="No active routes right now."
    >
      {state.status === "ready" && (
        <ul className="flex h-full flex-col gap-1">
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
      )}
    </WidgetShell>
  );
}
