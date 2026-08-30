"use client";

// HR Analytics — real PostgreSQL/API cutover (Production migration, Phase
// B, HR Sub-batch 4 final audit). Every metric below is DB-derived: staff
// counts + today's attendance reuse the existing real HR dashboard;
// department distribution reuses real Department.staffCount; recruitment
// funnel and onboarding progress are real, school-wide JobApplicant/
// EmployeeOnboarding aggregates added in this batch. No fabricated tenure,
// hiring-source, or engagement metrics — those had no real backing and were
// removed rather than kept as decorative mock charts.
import { Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MiniBar } from "@/components/dashboard/mini-charts";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useDepartments, useHrDashboard } from "@/lib/hooks/api/use-hr-api";
import { roleLabels } from "@/lib/permissions/roles";
import type { JobApplicantStageDto } from "@/lib/api/contracts";
import { downloadTextFile } from "@/lib/utils";

const stageLabels: Record<JobApplicantStageDto, string> = {
  applied: "Applied", screening: "Screening", interview: "Interview", selected: "Selected", hired: "Hired", rejected: "Rejected", withdrawn: "Withdrawn",
};
const FUNNEL_STAGES: JobApplicantStageDto[] = ["applied", "screening", "interview", "selected", "hired"];

export default function HrAnalyticsPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: dashboard, loading, error } = useHrDashboard();
  const { data: departments } = useDepartments({ status: "active" });

  if (!capabilitiesLoading && !hasServerPermission("hr.view") && !hasServerPermission("hr.manage")) {
    return <PermissionDenied action="view HR analytics" role={roleLabels[role]} backHref="/hr" />;
  }

  if (loading && !dashboard) return <p className="py-2xl text-center text-sm text-muted-foreground">Loading analytics…</p>;
  if (error || !dashboard) {
    return <div className="rounded-lg border border-error/30 bg-error/5 p-md text-sm text-error" role="alert">Could not load HR analytics{error ? `: ${error}` : ""}</div>;
  }

  const maxDept = Math.max(1, ...departments.map((d) => d.staffCount));
  const funnel = FUNNEL_STAGES.map((s) => ({ stage: stageLabels[s], count: dashboard.applicantsByStage[s] }));
  const maxFunnel = Math.max(1, ...funnel.map((f) => f.count));

  function exportHeadcount() {
    const lines = ["Department,Headcount", ...departments.map((d) => `"${d.name}",${d.staffCount}`)];
    downloadTextFile("hr-headcount.csv", lines.join("\n"));
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">HR analytics</h1>
          <p className="text-xs text-muted-foreground">Workforce insights — all figures derived live from real records</p>
        </div>
        <Button size="sm" variant="outline" onClick={exportHeadcount}><Download className="size-3.5" /> Export headcount</Button>
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Active staff" value={String(dashboard.activeStaff)} tone="neutral" />
        <StatTile label="Teaching" value={String(dashboard.teachingStaff)} tone="info" />
        <StatTile label="Non-teaching" value={String(dashboard.nonTeachingStaff)} tone="neutral" />
        <StatTile label="Departments" value={String(dashboard.departments)} tone="neutral" />
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-5">
        <StatTile label="Present today" value={String(dashboard.presentToday)} tone="success" />
        <StatTile label="Absent today" value={String(dashboard.absentToday)} tone={dashboard.absentToday > 0 ? "warning" : "success"} />
        <StatTile label="Late today" value={String(dashboard.lateToday)} tone={dashboard.lateToday > 0 ? "warning" : "success"} />
        <StatTile label="On leave" value={String(dashboard.onLeaveToday)} tone="info" />
        <StatTile label="New hires (month)" value={String(dashboard.newHiresThisMonth)} tone="info" />
      </div>

      <div className="grid grid-cols-1 gap-md lg:grid-cols-2">
        <Panel title="Department distribution">
          {departments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No departments found.</p>
          ) : (
            departments.map((d) => <Bar key={d.id} label={d.name} value={d.staffCount} percent={(d.staffCount / maxDept) * 100} />)
          )}
        </Panel>

        <Panel title="Recruitment funnel">
          <p className="text-xs text-muted-foreground">{dashboard.openJobOpenings} open position(s) · {dashboard.applicantsByStage.rejected} rejected · {dashboard.applicantsByStage.withdrawn} withdrawn</p>
          {funnel.every((f) => f.count === 0) ? (
            <p className="text-sm text-muted-foreground">No applicants found.</p>
          ) : (
            funnel.map((f) => <Bar key={f.stage} label={f.stage} value={f.count} percent={(f.count / maxFunnel) * 100} tone="bg-primary" />)
          )}
        </Panel>

        <Panel title="Onboarding">
          {dashboard.activeOnboardings === 0 ? (
            <p className="text-sm text-muted-foreground">No active onboarding.</p>
          ) : (
            <div className="flex items-center justify-between text-sm">
              <span className="text-foreground">{dashboard.activeOnboardings} active</span>
              <Badge tone="info">{dashboard.avgOnboardingProgress ?? 0}% avg. progress</Badge>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-md">
      <h2 className="mb-sm text-sm font-semibold text-foreground">{title}</h2>
      <div className="flex flex-col gap-sm">{children}</div>
    </div>
  );
}

function Bar({ label, value, percent, tone = "bg-primary" }: { label: string; value: number; percent: number; tone?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-foreground">{label}</span>
        <span className="text-muted-foreground">{value}</span>
      </div>
      <MiniBar percent={percent} toneClassName={tone} />
    </div>
  );
}
