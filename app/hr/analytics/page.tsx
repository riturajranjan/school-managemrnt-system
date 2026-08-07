"use client";

import { Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MiniBar } from "@/components/dashboard/mini-charts";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { CANDIDATE_PIPELINE, candidateStageLabels } from "@/lib/types/hr";
import { downloadTextFile } from "@/lib/utils";

export default function HrAnalyticsPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  if (!can("hr.viewAnalytics")) return <PermissionDenied action="view HR analytics" role={roleLabels[role]} backHref="/hr" />;

  const active = db.employees.filter((e) => e.status !== "inactive" && e.status !== "resigned" && e.status !== "retired");
  const byDept = db.departments.map((d) => ({ name: d.name, count: db.employees.filter((e) => e.departmentId === d.id).length }));
  const maxDept = Math.max(1, ...byDept.map((d) => d.count));

  // Tenure buckets (workforce tenure, non-sensitive).
  const now = new Date().getTime();
  const tenure = { "<1y": 0, "1-3y": 0, "3-5y": 0, "5y+": 0 };
  for (const e of active) {
    const years = (now - new Date(e.joiningDate).getTime()) / (365.25 * 86_400_000);
    if (years < 1) tenure["<1y"]++;
    else if (years < 3) tenure["1-3y"]++;
    else if (years < 5) tenure["3-5y"]++;
    else tenure["5y+"]++;
  }
  const maxTenure = Math.max(1, ...Object.values(tenure));

  // Hiring source distribution.
  const sources = new Map<string, number>();
  for (const c of db.candidates) sources.set(c.source, (sources.get(c.source) ?? 0) + 1);

  const funnel = CANDIDATE_PIPELINE.map((s) => ({ stage: candidateStageLabels[s], count: db.candidates.filter((c) => c.stage === s).length }));
  const maxFunnel = Math.max(1, ...funnel.map((f) => f.count));
  const teaching = active.filter((e) => e.isTeaching).length;

  function exportHeadcount() {
    const lines = ["Department,Headcount", ...byDept.map((d) => `"${d.name}",${d.count}`)];
    downloadTextFile("hr-headcount.csv", lines.join("\n"));
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">HR analytics</h1>
          <p className="text-xs text-muted-foreground">Workforce insights — aggregate only, no protected attributes</p>
        </div>
        <Button size="sm" variant="outline" onClick={exportHeadcount}><Download className="size-3.5" /> Export headcount</Button>
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Total staff" value={String(db.employees.length)} tone="neutral" />
        <StatTile label="Teaching" value={String(teaching)} tone="info" />
        <StatTile label="Non-teaching" value={String(active.length - teaching)} tone="neutral" />
        <StatTile label="Departments" value={String(db.departments.length)} tone="neutral" />
      </div>

      <div className="grid grid-cols-1 gap-md lg:grid-cols-2">
        <Panel title="Department distribution">
          {byDept.map((d) => (
            <Bar key={d.name} label={d.name} value={d.count} percent={(d.count / maxDept) * 100} />
          ))}
        </Panel>

        <Panel title="Workforce tenure">
          {Object.entries(tenure).map(([label, count]) => (
            <Bar key={label} label={label} value={count} percent={(count / maxTenure) * 100} tone="bg-info" />
          ))}
        </Panel>

        <Panel title="Recruitment funnel">
          {funnel.map((f) => (
            <Bar key={f.stage} label={f.stage} value={f.count} percent={(f.count / maxFunnel) * 100} tone="bg-primary" />
          ))}
        </Panel>

        <Panel title="Hiring source">
          {[...sources.entries()].sort((a, b) => b[1] - a[1]).map(([source, count]) => (
            <div key={source} className="flex items-center justify-between text-sm">
              <span className="capitalize text-foreground">{source.replace("-", " ")}</span>
              <Badge tone="neutral">{count}</Badge>
            </div>
          ))}
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
