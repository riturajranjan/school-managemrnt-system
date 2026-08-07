"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, ArrowRight, Bus, ClipboardList, Gauge, LayoutList, RefreshCw, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { MiniBar } from "@/components/dashboard/mini-charts";
import { PulseGauge } from "@/components/dashboard/pulse-gauge";
import { toneClasses } from "@/components/dashboard/tone";
import { StatTile } from "@/components/ui/stat-tile";
import { useSisStore } from "@/lib/hooks/use-store";
import { dailyTransportBrief, transportExceptions } from "@/lib/selectors/transport-brief";
import { computeTransportPulse } from "@/lib/selectors/transport-pulse";
import { formatDate } from "@/lib/utils";

const severityTone = { high: "error", medium: "warning", low: "neutral" } as const;

export default function TransportDashboardPage() {
  const db = useSisStore();
  const [pulseOpen, setPulseOpen] = useState(false);
  const [tick, setTick] = useState(0);

  const today = new Date().toISOString().slice(0, 10);
  const brief = dailyTransportBrief(db);
  const exceptions = transportExceptions(db);
  const pulse = computeTransportPulse(db);
  const sortedFactors = [...pulse.factors].sort((a, b) => a.score - b.score);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Transport Command Centre</h1>
          <p className="text-xs text-muted-foreground">{formatDate(today)} · {brief.tripsToday} trip(s) scheduled</p>
        </div>
        <div className="flex flex-wrap gap-xs">
          <Button size="sm" variant="outline" onClick={() => setTick((t) => t + 1)}>
            <RefreshCw className="size-3.5" />
            Refresh
          </Button>
          <Button asChild size="sm">
            <Link href="/transport/live">
              <Bus className="size-3.5" />
              Live tracking
            </Link>
          </Button>
        </div>
      </div>

      <section aria-label="Transport summary" className="grid grid-cols-2 gap-sm sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label="Trips today" value={String(brief.tripsToday)} icon={ClipboardList} tone="neutral" />
        <StatTile label="In progress" value={String(brief.tripsInProgress)} icon={Bus} tone={brief.tripsInProgress > 0 ? "info" : "neutral"} />
        <StatTile label="Completed" value={String(brief.tripsCompleted)} icon={ClipboardList} tone="success" />
        <StatTile label="Delayed" value={String(brief.tripsDelayed)} icon={AlertTriangle} tone={brief.tripsDelayed > 0 ? "warning" : "success"} />
        <StatTile label="Students in transit" value={String(brief.studentsInTransit)} icon={UsersRound} tone="neutral" />
      </section>

      <div className="grid grid-cols-1 gap-md lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-md">
          <div className="rounded-lg border border-border bg-surface p-md">
            <div className="mb-sm flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Exception feed</h2>
              <Badge tone={exceptions.length === 0 ? "success" : "warning"}>{exceptions.length} item(s)</Badge>
            </div>
            {exceptions.length === 0 ? (
              <p className="py-md text-center text-sm text-muted-foreground">No issues need attention right now.</p>
            ) : (
              <ul className="flex flex-col gap-sm">
                {exceptions.map((exception) => (
                  <li key={exception.id}>
                    <Link href={exception.href} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm transition-colors hover:border-primary/40">
                      <div className="flex min-w-0 items-center gap-2">
                        <AlertTriangle className={`size-4 shrink-0 ${exception.severity === "high" ? "text-error" : exception.severity === "medium" ? "text-warning" : "text-muted-foreground"}`} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{exception.label}</p>
                          <p className="truncate text-xs text-muted-foreground">{exception.description}</p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Badge tone={severityTone[exception.severity]}>{exception.severity}</Badge>
                        <ArrowRight className="size-3.5 text-muted-foreground" />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-lg border border-border bg-surface p-md">
            <h2 className="mb-sm text-sm font-semibold text-foreground">Live operations brief</h2>
            <p className="text-sm text-foreground">
              {brief.tripsCompleted} of {brief.tripsToday} trip(s) completed, {brief.tripsInProgress} in progress
              {brief.tripsDelayed > 0 ? `, ${brief.tripsDelayed} delayed` : ""}
              {brief.tripsNotStarted > 0 ? `, ${brief.tripsNotStarted} not yet started` : ""}.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{brief.studentsInTransit} student(s) currently on a bus.</p>
          </div>
        </div>

        <div className="flex flex-col gap-md">
          <div className="rounded-lg border border-border bg-surface p-md">
            <div className="mb-sm flex items-center justify-between">
              <h2 className="flex items-center gap-1 text-sm font-semibold text-foreground">
                <Gauge className="size-4" /> Transport Pulse
              </h2>
              <button type="button" onClick={() => setPulseOpen(true)} className="flex items-center gap-1 text-xs font-medium text-primary">
                <LayoutList className="size-3.5" />
                Breakdown
              </button>
            </div>
            <div className="flex flex-col items-center gap-sm">
              <PulseGauge key={tick} score={pulse.score} factors={pulse.factors} />
              <p className="text-center text-xs text-muted-foreground">
                Strongest: <span className="font-medium text-foreground">{sortedFactors[sortedFactors.length - 1].label}</span> · Main concern:{" "}
                <span className="font-medium text-foreground">{sortedFactors[0].label}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <DetailDrawer open={pulseOpen} onOpenChange={setPulseOpen} title="Transport Pulse breakdown" description="All factors contributing to the composite score">
        <div className="flex flex-col gap-md">
          {pulse.factors.map((factor) => (
            <div key={factor.key} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">{factor.label}</span>
                <span className={toneClasses[factor.tone].text}>{factor.displayValue}</span>
              </div>
              <MiniBar percent={factor.score} toneClassName={toneClasses[factor.tone].dot} />
            </div>
          ))}
        </div>
      </DetailDrawer>
    </div>
  );
}
