"use client";

import Link from "next/link";
import { BriefcaseBusiness, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { employmentTypeLabels, jobStatusLabels, type JobStatus } from "@/lib/types/hr";
import { formatDate } from "@/lib/utils";
import { formatMoney } from "@/lib/finance/money";

const tone: Record<JobStatus, "success" | "warning" | "error" | "neutral" | "info"> = { draft: "neutral", open: "success", paused: "warning", closed: "neutral", filled: "info" };

export default function JobsPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  if (!can("hr.view") && !can("hr.manageRecruitment")) return <PermissionDenied action="view jobs" role={roleLabels[role]} backHref="/hr" />;
  const deptName = (id: string) => db.departments.find((d) => d.id === id)?.name ?? "—";

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Jobs</h1>
          <p className="text-xs text-muted-foreground">{db.recruitmentJobs.length} job postings</p>
        </div>
        {can("hr.manageRecruitment") && <Button asChild size="sm"><Link href="/hr/recruitment/jobs/new"><Plus className="size-3.5" /> Create job</Link></Button>}
      </div>

      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
        {db.recruitmentJobs.map((job) => {
          const applicants = db.candidates.filter((c) => c.jobId === job.id).length;
          return (
            <Link key={job.id} href={`/hr/recruitment/jobs/${job.id}`} className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md hover:border-primary/40">
              <div className="flex items-start justify-between gap-sm">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{job.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{deptName(job.departmentId)} · {employmentTypeLabels[job.employmentType]}</p>
                </div>
                <Badge tone={tone[job.status]}>{jobStatusLabels[job.status]}</Badge>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{job.openings} opening(s) · {applicants} applicant(s)</span>
                <span>{formatMoney(job.salaryMin, { compact: true })}–{formatMoney(job.salaryMax, { compact: true })}</span>
              </div>
              <p className="flex items-center gap-1 text-xs text-muted-foreground"><BriefcaseBusiness className="size-3" /> Closes {formatDate(job.deadline)}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
