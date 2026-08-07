"use client";

import Link from "next/link";
import { BriefcaseBusiness, CalendarClock, Plus, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { RecruitmentPipeline } from "@/components/hr/recruitment-pipeline";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { CANDIDATE_PIPELINE, jobStatusLabels, type CandidateStage } from "@/lib/types/hr";

export default function RecruitmentPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  if (!can("hr.view") && !can("hr.manageRecruitment")) return <PermissionDenied action="view recruitment" role={roleLabels[role]} backHref="/hr" />;

  const openPositions = db.recruitmentJobs.filter((j) => j.status === "open").reduce((s, j) => s + j.openings, 0);
  const today = new Date().toISOString().slice(0, 10);
  const counts = CANDIDATE_PIPELINE.reduce((acc, s) => { acc[s] = db.candidates.filter((c) => c.stage === s).length; return acc; }, {} as Record<CandidateStage, number>);
  const rejected = db.candidates.filter((c) => c.stage === "rejected").length;
  const interviewsToday = db.interviews.filter((i) => i.date === today && i.status === "scheduled").length;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Recruitment</h1>
          <p className="text-xs text-muted-foreground">Jobs, candidate pipeline and interviews</p>
        </div>
        <div className="flex flex-wrap gap-xs">
          <Button asChild size="sm" variant="outline"><Link href="/hr/recruitment/candidates"><Users className="size-3.5" /> Candidates</Link></Button>
          <Button asChild size="sm" variant="outline"><Link href="/hr/recruitment/interviews"><CalendarClock className="size-3.5" /> Interviews</Link></Button>
          {can("hr.manageRecruitment") && <Button asChild size="sm"><Link href="/hr/recruitment/jobs/new"><Plus className="size-3.5" /> Create job</Link></Button>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Open positions" value={String(openPositions)} icon={BriefcaseBusiness} tone={openPositions > 0 ? "warning" : "success"} />
        <StatTile label="Candidates" value={String(db.candidates.length)} icon={Users} tone="neutral" />
        <StatTile label="Interviews today" value={String(interviewsToday)} icon={CalendarClock} tone="info" />
        <StatTile label="Rejected" value={String(rejected)} icon={Users} tone="neutral" />
      </div>

      <div className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">Candidate pipeline</h2>
        <RecruitmentPipeline counts={counts} />
      </div>

      <div className="rounded-lg border border-border bg-surface p-md">
        <div className="mb-sm flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Open jobs</h2>
          <Link href="/hr/recruitment/jobs" className="text-xs text-primary">All jobs →</Link>
        </div>
        <div className="flex flex-col gap-sm">
          {db.recruitmentJobs.filter((j) => j.status === "open" || j.status === "paused").map((job) => {
            const applicants = db.candidates.filter((c) => c.jobId === job.id).length;
            return (
              <Link key={job.id} href={`/hr/recruitment/jobs/${job.id}`} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm hover:border-primary/40">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{job.title}</p>
                  <p className="text-xs text-muted-foreground">{job.openings} opening(s) · {applicants} applicant(s)</p>
                </div>
                <Badge tone={job.status === "open" ? "success" : "warning"}>{jobStatusLabels[job.status]}</Badge>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
