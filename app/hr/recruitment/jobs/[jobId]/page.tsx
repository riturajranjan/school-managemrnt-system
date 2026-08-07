"use client";

import Link from "next/link";
import { use, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmployeeAvatar } from "@/components/hr/employee-avatar";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { updateJobStatus } from "@/lib/services/hr-service";
import { roleLabels } from "@/lib/permissions/roles";
import { candidateStageLabels, employmentTypeLabels, jobStatusLabels, type JobStatus } from "@/lib/types/hr";
import { formatDate } from "@/lib/utils";
import { formatMoney } from "@/lib/finance/money";

export default function JobDetailPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = use(params);
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [, force] = useState(0);

  const job = db.recruitmentJobs.find((j) => j.id === jobId);
  if (!can("hr.view") && !can("hr.manageRecruitment")) return <PermissionDenied action="view jobs" role={roleLabels[role]} backHref="/hr/recruitment/jobs" />;
  if (!job) {
    return <div className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Job not found. <Link href="/hr/recruitment/jobs" className="text-primary">Back</Link></div>;
  }

  const applicants = db.candidates.filter((c) => c.jobId === job.id);
  const deptName = db.departments.find((d) => d.id === job.departmentId)?.name ?? "—";
  const canManage = can("hr.manageRecruitment");

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-sm">
        <Button asChild size="icon" variant="ghost" aria-label="Back"><Link href="/hr/recruitment/jobs"><ArrowLeft className="size-4" /></Link></Button>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold text-foreground">{job.title}</h1>
          <p className="truncate text-xs text-muted-foreground">{deptName} · {employmentTypeLabels[job.employmentType]}</p>
        </div>
      </div>

      <div className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
        <div className="flex flex-wrap items-center justify-between gap-sm">
          <div className="flex flex-wrap items-center gap-xs">
            <Badge tone={job.status === "open" ? "success" : job.status === "paused" ? "warning" : "neutral"}>{jobStatusLabels[job.status]}</Badge>
            <Badge tone="neutral">{job.openings} opening(s)</Badge>
            <Badge tone="info">{applicants.length} applicant(s)</Badge>
          </div>
          {canManage && (
            <Select value={job.status} onValueChange={(v) => { updateJobStatus(job.id, v as JobStatus); force((n) => n + 1); }}>
              <SelectTrigger className="w-36" aria-label="Job status"><SelectValue /></SelectTrigger>
              <SelectContent>{(Object.keys(jobStatusLabels) as JobStatus[]).map((s) => <SelectItem key={s} value={s}>{jobStatusLabels[s]}</SelectItem>)}</SelectContent>
            </Select>
          )}
        </div>
        <div className="grid grid-cols-2 gap-sm text-sm sm:grid-cols-4">
          <Field label="Salary range" value={`${formatMoney(job.salaryMin, { compact: true })}–${formatMoney(job.salaryMax, { compact: true })}`} />
          <Field label="Min experience" value={`${job.minExperienceYears} yrs`} />
          <Field label="Qualification" value={job.qualification} />
          <Field label="Closes" value={formatDate(job.deadline)} />
        </div>
        {job.description && <p className="text-sm text-muted-foreground">{job.description}</p>}
      </div>

      <div className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">Applicants</h2>
        {applicants.length === 0 ? (
          <p className="py-md text-center text-sm text-muted-foreground">No applicants yet.</p>
        ) : (
          <div className="flex flex-col gap-sm">
            {applicants.map((c) => (
              <Link key={c.id} href={`/hr/recruitment/candidates/${c.id}`} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm hover:border-primary/40">
                <div className="flex min-w-0 items-center gap-sm">
                  <EmployeeAvatar firstName={c.firstName} lastName={c.lastName} color="#7c3aed" size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{c.firstName} {c.lastName}</p>
                    <p className="truncate text-xs text-muted-foreground">{c.experienceYears} yrs · {c.qualification}</p>
                  </div>
                </div>
                <Badge tone={c.stage === "rejected" ? "error" : c.stage === "hired" ? "success" : "info"}>{candidateStageLabels[c.stage]}</Badge>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
