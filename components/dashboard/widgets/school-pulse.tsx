"use client";

import { Activity, TrendingDown, TrendingUp } from "lucide-react";
import { fetchSchoolPulse } from "../data/mock-data";
import { toneClasses } from "../tone";
import { useWidgetData } from "../use-widget-data";
import { WidgetShell } from "../widget-shell";

export function SchoolPulseWidget() {
  const state = useWidgetData(fetchSchoolPulse);

  return (
    <WidgetShell
      title="School Pulse"
      icon={Activity}
      status={state.status}
      error={state.status === "error" ? state.error : undefined}
      onRetry={state.retry}
      isEmpty={state.status === "ready" && state.data.metrics.length === 0}
      emptyMessage="No live metrics yet today."
    >
      {state.status === "ready" && (
        <div className="grid h-full grid-cols-2 gap-sm">
          {state.data.metrics.map((metric) => {
            const TrendIcon = metric.trend === "up" ? TrendingUp : metric.trend === "down" ? TrendingDown : null;
            return (
              <div key={metric.key} className="flex flex-col justify-center rounded-md bg-surface-secondary px-sm py-xs">
                <p className="truncate text-xs text-muted-foreground">{metric.label}</p>
                <p className="text-lg font-semibold leading-tight text-foreground">{metric.value}</p>
                <p className={`flex items-center gap-0.5 text-xs font-medium ${toneClasses[metric.tone].text}`}>
                  {TrendIcon && <TrendIcon className="size-3" aria-hidden="true" />}
                  {metric.delta}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </WidgetShell>
  );
}
