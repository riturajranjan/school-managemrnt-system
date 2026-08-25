"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, BedDouble, Gauge, HandHeart, HeartPulse, Hotel, LayoutList, UtensilsCrossed, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { MiniBar } from "@/components/dashboard/mini-charts";
import { PulseGauge } from "@/components/dashboard/pulse-gauge";
import { toneClasses } from "@/components/dashboard/tone";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useShell } from "@/components/shell/shell-context";
import { useSisStore } from "@/lib/hooks/use-store";
import { cafeteriaSummary, healthSummary, hostelSummary } from "@/lib/selectors/campus-brief";
import { computeCampusPulse } from "@/lib/selectors/campus-pulse";
import { roleLabels } from "@/lib/permissions/roles";
import { formatDate } from "@/lib/utils";

export default function CampusLifeCommandCentre() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const { activeSession } = useShell();
  const [pulseOpen, setPulseOpen] = useState(false);

  const anyAccess = can("hostel.view") || can("health.view") || can("counseling.view") || can("cafeteria.view");
  if (!anyAccess) return <PermissionDenied action="view campus services" role={roleLabels[role]} backHref="/" />;

  const today = new Date().toISOString().slice(0, 10);
  const hostel = hostelSummary(db);
  const health = healthSummary(db);
  const cafe = cafeteriaSummary(db);
  const pulse = computeCampusPulse(db);
  const sorted = [...pulse.factors].sort((a, b) => a.score - b.score);
  const todayMenu = db.hostelMess.find((m) => m.date === today) ?? db.hostelMess[0];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Student Life & Campus Services</h1>
        <p className="text-xs text-muted-foreground">Hostel · Health · Counselling · Cafeteria · {activeSession} · {formatDate(today)}</p>
      </div>

      <div className="grid grid-cols-1 gap-md lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-md">
          {can("hostel.view") && (
            <section>
              <div className="mb-sm flex items-center justify-between"><h2 className="flex items-center gap-1 text-sm font-semibold text-foreground"><Hotel className="size-4" /> Hostel</h2><Link href="/hostel/dashboard" className="text-xs text-primary">Open →</Link></div>
              <div className="grid grid-cols-2 gap-sm sm:grid-cols-3 lg:grid-cols-6">
                <StatTile label="Residents" value={String(hostel.residents)} icon={BedDouble} tone="neutral" />
                <StatTile label="Occupancy" value={`${hostel.occupancyPercent}%`} tone="info" />
                <StatTile label="Available" value={String(hostel.available)} tone="success" />
                <StatTile label="On leave" value={String(hostel.onLeave)} tone="info" />
                <StatTile label="Visitors" value={String(hostel.visitorsToday)} tone="neutral" />
                <StatTile label="Complaints" value={String(hostel.openComplaints)} icon={Wrench} tone={hostel.openComplaints > 0 ? "warning" : "success"} />
              </div>
            </section>
          )}

          {can("health.view") && (
            <section>
              <div className="mb-sm flex items-center justify-between"><h2 className="flex items-center gap-1 text-sm font-semibold text-foreground"><HeartPulse className="size-4" /> Health</h2><Link href="/health/dashboard" className="text-xs text-primary">Open →</Link></div>
              <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
                <StatTile label="Visits today" value={String(health.visitsToday)} tone="neutral" />
                <StatTile label="Resting" value={String(health.resting)} tone={health.resting > 0 ? "warning" : "success"} />
                <StatTile label="Follow-ups" value={String(health.followUps)} tone="info" />
                <StatTile label="Open incidents" value={String(health.openIncidents)} icon={AlertTriangle} tone={health.openIncidents > 0 ? "warning" : "success"} />
              </div>
            </section>
          )}

          {can("cafeteria.view") && (
            <section>
              <div className="mb-sm flex items-center justify-between"><h2 className="flex items-center gap-1 text-sm font-semibold text-foreground"><UtensilsCrossed className="size-4" /> Cafeteria</h2><Link href="/cafeteria/dashboard" className="text-xs text-primary">Open →</Link></div>
              <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
                <StatTile label="Meals served" value={String(cafe.mealsServedMock)} tone="neutral" />
                <StatTile label="Meal plans" value={String(cafe.mealPlanUsers)} tone="info" />
                <StatTile label="Pending orders" value={String(cafe.pendingOrders)} tone={cafe.pendingOrders > 0 ? "warning" : "success"} />
                <StatTile label="Out of stock" value={String(cafe.outOfStock)} icon={AlertTriangle} tone={cafe.outOfStock > 0 ? "error" : "success"} />
              </div>
              {todayMenu && <p className="mt-sm text-xs text-muted-foreground">Today&apos;s lunch: <span className="text-foreground">{todayMenu.lunch.items.join(", ")}</span></p>}
            </section>
          )}
        </div>

        <div className="rounded-lg border border-border bg-surface p-md">
          <div className="mb-sm flex items-center justify-between">
            <h2 className="flex items-center gap-1 text-sm font-semibold text-foreground"><Gauge className="size-4" /> Campus Wellbeing Pulse</h2>
            <button type="button" onClick={() => setPulseOpen(true)} className="flex items-center gap-1 text-xs font-medium text-primary"><LayoutList className="size-3.5" /> Breakdown</button>
          </div>
          <div className="flex flex-col items-center gap-sm">
            <PulseGauge score={pulse.score} factors={pulse.factors} />
            <p className="text-center text-xs text-muted-foreground">Operational score only — not a medical or wellbeing diagnosis.</p>
            <p className="text-center text-xs text-muted-foreground">Strongest: <span className="font-medium text-foreground">{sorted[sorted.length - 1].label}</span> · Concern: <span className="font-medium text-foreground">{sorted[0].label}</span></p>
          </div>
          <div className="mt-md grid grid-cols-2 gap-xs">
            {can("hostel.view") && <Button asChild size="sm" variant="outline"><Link href="/hostel"><Hotel className="size-3.5" /> Hostel</Link></Button>}
            {can("health.view") && <Button asChild size="sm" variant="outline"><Link href="/health"><HeartPulse className="size-3.5" /> Health</Link></Button>}
            {can("counseling.view") && <Button asChild size="sm" variant="outline"><Link href="/counselling"><HandHeart className="size-3.5" /> Counselling</Link></Button>}
            {can("cafeteria.view") && <Button asChild size="sm" variant="outline"><Link href="/cafeteria"><UtensilsCrossed className="size-3.5" /> Cafeteria</Link></Button>}
          </div>
        </div>
      </div>

      <DetailDrawer open={pulseOpen} onOpenChange={setPulseOpen} title="Campus Wellbeing Pulse breakdown" description="Operational service factors (not medical scoring)">
        <div className="flex flex-col gap-md">
          <p className="rounded-md border border-border bg-surface-secondary/40 p-sm text-xs text-muted-foreground">This score reflects service operations only — attendance completeness, room readiness, maintenance load, infirmary workload, follow-ups, meal readiness and open issues. It never diagnoses, scores or predicts any student&apos;s health.</p>
          {pulse.factors.map((factor) => (
            <div key={factor.key} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-sm"><span className="font-medium text-foreground">{factor.label}</span><span className={toneClasses[factor.tone].text}>{factor.displayValue}</span></div>
              <MiniBar percent={factor.score} toneClassName={toneClasses[factor.tone].dot} />
            </div>
          ))}
        </div>
      </DetailDrawer>
    </div>
  );
}
