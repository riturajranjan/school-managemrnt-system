"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Award,
  BriefcaseBusiness,
  CalendarDays,
  ClipboardCheck,
  Download,
  FileText,
  Gauge,
  GraduationCap,
  LayoutList,
  ScrollText,
  UserPlus,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { hrSummary, hrTodayItems } from "@/lib/selectors/hr-brief";
import { computePeoplePulse } from "@/lib/selectors/people-pulse";
import { roleLabels } from "@/lib/permissions/roles";
import { formatDate } from "@/lib/utils";

export default function HrDashboardPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const { activeSession } = useShell();
  const [pulseOpen, setPulseOpen] = useState(false);

  if (!can("hr.view")) return <PermissionDenied action="view the HR command centre" role={roleLabels[role]} backHref="/hr/employee-self-service" />;

  const today = new Date().toISOString().slice(0, 10);
  const summary = hrSummary(db);
  const todayItems = hrTodayItems(db);
  const pulse = computePeoplePulse(db);
  const sorted = [...pulse.factors].sort((a, b) => a.score - b.score);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      {/* Header */}
      <div className="flex flex-col gap-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">HR Command Centre</h1>
          <p className="text-xs text-muted-foreground">All departments · {activeSession} · {formatDate(today)}</p>
        </div>
        <div className="flex flex-wrap gap-xs">
          <Button asChild size="sm">
            <Link href="/hr/staff/new">
              <UserPlus className="size-3.5" /> Add employee
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/hr/recruitment/jobs/new">
              <BriefcaseBusiness className="size-3.5" /> Create job
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/hr/leave">
              <CalendarDays className="size-3.5" /> Record leave
            </Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link href="/hr/analytics">
              <Download className="size-3.5" /> Export
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI metrics */}
      <section aria-label="HR summary" className="grid grid-cols-2 gap-sm sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Active staff" value={String(summary.activeStaff)} icon={Users} tone="neutral" />
        <StatTile label="Present" value={String(summary.presentToday)} icon={ClipboardCheck} tone="success" />
        <StatTile label="Absent" value={String(summary.absentToday)} icon={AlertTriangle} tone={summary.absentToday > 0 ? "warning" : "success"} />
        <StatTile label="On leave" value={String(summary.onLeave)} icon={CalendarDays} tone="info" />
        <StatTile label="Late" value={String(summary.lateToday)} icon={AlertTriangle} tone={summary.lateToday > 0 ? "warning" : "success"} />
        <StatTile label="New hires" value={String(summary.newHires)} icon={UserPlus} tone="neutral" />
        <StatTile label="Open positions" value={String(summary.openPositions)} icon={BriefcaseBusiness} tone={summary.openPositions > 0 ? "warning" : "success"} />
        <StatTile label="Interviews today" value={String(summary.interviewsToday)} icon={BriefcaseBusiness} tone="info" />
        <StatTile label="Contracts expiring" value={String(summary.contractsExpiring)} icon={FileText} tone={summary.contractsExpiring > 0 ? "warning" : "success"} />
        <StatTile label="Docs expiring" value={String(summary.documentsExpiring)} icon={ScrollText} tone={summary.documentsExpiring > 0 ? "warning" : "success"} />
        <StatTile label="Appraisals pending" value={String(summary.appraisalsPending)} icon={Award} tone={summary.appraisalsPending > 0 ? "warning" : "success"} />
        <StatTile label="Training overdue" value={String(summary.trainingOverdue)} icon={GraduationCap} tone={summary.trainingOverdue > 0 ? "warning" : "success"} />
      </section>

      <div className="grid grid-cols-1 gap-md lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Today in HR */}
        <div className="rounded-lg border border-border bg-surface p-md">
          <div className="mb-sm flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Today in HR</h2>
            <Badge tone={todayItems.length === 0 ? "success" : "warning"}>{todayItems.length} item(s)</Badge>
          </div>
          {todayItems.length === 0 ? (
            <p className="py-md text-center text-sm text-muted-foreground">Nothing needs HR attention today.</p>
          ) : (
            <ul className="flex flex-col gap-sm">
              {todayItems.map((item) => (
                <li key={item.id}>
                  <Link href={item.href} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm transition-colors hover:border-primary/40">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={`size-1.5 shrink-0 rounded-pill ${toneClasses[item.tone].dot}`} aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{item.label}</p>
                        <p className="truncate text-xs text-muted-foreground">{item.detail}</p>
                      </div>
                    </div>
                    <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* People Pulse */}
        <div className="rounded-lg border border-border bg-surface p-md">
          <div className="mb-sm flex items-center justify-between">
            <h2 className="flex items-center gap-1 text-sm font-semibold text-foreground">
              <Gauge className="size-4" /> People Pulse
            </h2>
            <button type="button" onClick={() => setPulseOpen(true)} className="flex items-center gap-1 text-xs font-medium text-primary">
              <LayoutList className="size-3.5" /> Breakdown
            </button>
          </div>
          <div className="flex flex-col items-center gap-sm">
            <PulseGauge score={pulse.score} factors={pulse.factors} />
            <p className="text-center text-xs text-muted-foreground">
              Strongest: <span className="font-medium text-foreground">{sorted[sorted.length - 1].label}</span> · Main risk: <span className="font-medium text-foreground">{sorted[0].label}</span>
            </p>
            <p className="text-center text-xs text-muted-foreground">
              Recommended: <span className="font-medium text-foreground">Focus on {sorted[0].label.toLowerCase()}</span>
            </p>
          </div>
        </div>
      </div>

      <DetailDrawer open={pulseOpen} onOpenChange={setPulseOpen} title="People Pulse breakdown" description="All factors contributing to the workforce-health score">
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
