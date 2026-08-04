"use client";

import { AlertTriangle, Gauge, LayoutList, ThumbsUp, TrendingDown, TrendingUp } from "lucide-react";
import { useState } from "react";
import type { PulseStatus } from "../data/types";
import { fetchSchoolPulse } from "../data/mock-data";
import { DetailDrawer } from "../detail-drawer";
import { MiniBar } from "../mini-charts";
import { PulseGauge } from "../pulse-gauge";
import { toneClasses } from "../tone";
import { useWidgetData } from "../use-widget-data";
import { WidgetShell, widgetActionButtonClass } from "../widget-shell";

const STATUS_TONE: Record<PulseStatus, keyof typeof toneClasses> = {
  Excellent: "success",
  Good: "success",
  "Needs Attention": "warning",
  Critical: "error",
};

export function SchoolPulseWidget() {
  const state = useWidgetData(fetchSchoolPulse);
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  return (
    <>
      <WidgetShell
        title="School Pulse"
        icon={Gauge}
        status={state.status}
        error={state.status === "error" ? state.error : undefined}
        onRetry={state.retry}
        isEmpty={state.status === "ready" && state.data.factors.length === 0}
        emptyMessage="No operational data available yet."
        action={
          state.status === "ready" ? (
            <button
              type="button"
              onClick={() => setBreakdownOpen(true)}
              className={widgetActionButtonClass}
            >
              <LayoutList className="size-3.5" aria-hidden="true" />
              Breakdown
            </button>
          ) : undefined
        }
      >
        {state.status === "ready" && (
          <div className="flex h-full flex-col items-center gap-md sm:flex-row sm:items-start">
            <PulseGauge score={state.data.score} factors={state.data.factors} />

            <div className="flex w-full min-w-0 flex-1 flex-col gap-sm text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center gap-xs sm:justify-start">
                <span className={`rounded-pill px-sm py-0.5 text-xs font-semibold ${toneClasses[STATUS_TONE[state.data.status]].soft}`}>
                  {state.data.status}
                </span>
                <span
                  className={`flex items-center gap-0.5 text-xs font-medium ${
                    state.data.weeklyChangePts >= 0 ? "text-success" : "text-error"
                  }`}
                >
                  {state.data.weeklyChangePts >= 0 ? (
                    <TrendingUp className="size-3" aria-hidden="true" />
                  ) : (
                    <TrendingDown className="size-3" aria-hidden="true" />
                  )}
                  {state.data.weeklyChangePts >= 0 ? "+" : ""}
                  {state.data.weeklyChangePts} pts this week
                </span>
              </div>

              <div className="flex flex-col gap-xs">
                <div className="flex items-start gap-xs">
                  <ThumbsUp className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden="true" />
                  <p className="text-xs text-foreground">
                    <span className="font-medium">{state.data.positiveFactor.label}: </span>
                    <span className="text-muted-foreground">{state.data.positiveFactor.detail}</span>
                  </p>
                </div>
                <div className="flex items-start gap-xs">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden="true" />
                  <p className="text-xs text-foreground">
                    <span className="font-medium">{state.data.riskFactor.label}: </span>
                    <span className="text-muted-foreground">{state.data.riskFactor.detail}</span>
                  </p>
                </div>
              </div>

              <p className="rounded-md bg-surface-secondary px-sm py-xs text-xs text-foreground">
                {state.data.recommendedAction}
              </p>
            </div>
          </div>
        )}
      </WidgetShell>

      <DetailDrawer
        open={breakdownOpen}
        onOpenChange={setBreakdownOpen}
        title="School Pulse breakdown"
        description="All 8 factors contributing to the composite operational score."
      >
        {state.status === "ready" && (
          <div className="flex flex-col gap-md">
            {state.data.factors.map((factor) => (
              <div key={factor.key} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">{factor.label}</span>
                  <span className={toneClasses[factor.tone].text}>{factor.displayValue}</span>
                </div>
                <MiniBar percent={factor.score} toneClassName={toneClasses[factor.tone].dot} />
              </div>
            ))}
          </div>
        )}
      </DetailDrawer>
    </>
  );
}
