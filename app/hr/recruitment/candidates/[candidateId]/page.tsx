"use client";

import Link from "next/link";
import { use, useState } from "react";
import { ArrowLeft, CalendarPlus, Check, UserCheck, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmployeeAvatar } from "@/components/hr/employee-avatar";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { convertCandidateToEmployee, moveCandidateStage, scheduleInterview } from "@/lib/services/hr-service";
import { roleLabels } from "@/lib/permissions/roles";
import { CANDIDATE_PIPELINE, candidateStageLabels, interviewTypeLabels } from "@/lib/types/hr";
import { formatDate } from "@/lib/utils";
import { useRouter } from "next/navigation";

export default function CandidateWorkspacePage({ params }: { params: Promise<{ candidateId: string }> }) {
  const { candidateId } = use(params);
  const db = useSisStore();
  const router = useRouter();
  const { can, role } = usePermissions();
  const [, force] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);

  const candidate = db.candidates.find((c) => c.id === candidateId);
  if (!can("hr.view") && !can("hr.manageRecruitment")) return <PermissionDenied action="view candidates" role={roleLabels[role]} backHref="/hr/recruitment/candidates" />;
  if (!candidate) return <div className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Candidate not found. <Link href="/hr/recruitment/candidates" className="text-primary">Back</Link></div>;

  const canManage = can("hr.manageRecruitment");
  const job = db.recruitmentJobs.find((j) => j.id === candidate.jobId);
  const interviews = db.interviews.filter((i) => i.candidateId === candidate.id);
  const currentIndex = CANDIDATE_PIPELINE.indexOf(candidate.stage);
  const nextStage = currentIndex >= 0 && currentIndex < CANDIDATE_PIPELINE.length - 1 ? CANDIDATE_PIPELINE[currentIndex + 1] : null;

  function advance() {
    if (nextStage) { moveCandidateStage(candidate!.id, nextStage); setFlash(`Moved to ${candidateStageLabels[nextStage]}.`); force((n) => n + 1); }
  }
  function reject() { moveCandidateStage(candidate!.id, "rejected"); setFlash("Candidate rejected."); force((n) => n + 1); }
  function schedule() {
    scheduleInterview({ candidateId: candidate!.id, jobId: candidate!.jobId, type: "screening", date: new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10), time: "10:00", interviewerIds: [], location: "Conference Room A" });
    setFlash("Interview scheduled.");
    force((n) => n + 1);
  }
  function convert() {
    const r = convertCandidateToEmployee(candidate!.id);
    if (r.ok && r.employee) router.push(`/hr/staff/${r.employee.id}`);
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-sm">
        <Button asChild size="icon" variant="ghost" aria-label="Back"><Link href="/hr/recruitment/candidates"><ArrowLeft className="size-4" /></Link></Button>
        <div className="flex min-w-0 items-center gap-sm">
          <EmployeeAvatar firstName={candidate.firstName} lastName={candidate.lastName} color="#7c3aed" size="md" />
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-foreground">{candidate.firstName} {candidate.lastName}</h1>
            <p className="truncate text-xs text-muted-foreground">{job?.title ?? "—"} · {candidate.experienceYears} yrs</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-xs">
        <Badge tone={candidate.stage === "rejected" ? "error" : candidate.stage === "hired" ? "success" : "info"}>{candidateStageLabels[candidate.stage]}</Badge>
        {candidate.score && <Badge tone="neutral">Score {candidate.score}</Badge>}
        <Badge tone="neutral">{candidate.source}</Badge>
      </div>

      {flash && <div className="rounded-md border border-success/30 bg-success/8 p-sm text-sm text-success" role="status">{flash}</div>}

      {canManage && candidate.stage !== "rejected" && candidate.stage !== "hired" && (
        <div className="flex flex-wrap gap-xs">
          {nextStage && <Button size="sm" onClick={advance}><Check className="size-3.5" /> Move to {candidateStageLabels[nextStage]}</Button>}
          <Button size="sm" variant="outline" onClick={schedule}><CalendarPlus className="size-3.5" /> Schedule interview</Button>
          {candidate.stage === "offer" && <Button size="sm" variant="outline" onClick={convert}><UserCheck className="size-3.5" /> Convert to employee</Button>}
          <Button size="sm" variant="ghost" onClick={reject}><X className="size-3.5" /> Reject</Button>
        </div>
      )}

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="interviews">Interviews ({interviews.length})</TabsTrigger>
          <TabsTrigger value="application">Application</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-md">
          <dl className="grid grid-cols-2 gap-sm text-sm sm:grid-cols-3">
            <Field label="Email" value={candidate.email} />
            <Field label="Phone" value={candidate.phone} />
            <Field label="Experience" value={`${candidate.experienceYears} yrs`} />
            <Field label="Qualification" value={candidate.qualification} />
            <Field label="Source" value={candidate.source} />
            <Field label="Applied" value={formatDate(candidate.appliedAt)} />
          </dl>
        </TabsContent>
        <TabsContent value="interviews" className="mt-md">
          {interviews.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No interviews scheduled.</div>
          ) : (
            <div className="flex flex-col gap-sm">
              {interviews.map((i) => (
                <div key={i.id} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
                  <div>
                    <p className="text-sm font-medium text-foreground">{interviewTypeLabels[i.type]}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(i.date)} · {i.time} · {i.location}</p>
                  </div>
                  <Badge tone={i.status === "completed" ? "success" : "info"}>{i.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="application" className="mt-md">
          <div className="rounded-lg border border-border bg-surface p-md text-sm text-muted-foreground">
            <p>Applied for <span className="font-medium text-foreground">{job?.title ?? "—"}</span> via {candidate.source}.</p>
            <p className="mt-1">Resume and assessment attachments are not stored in this frontend build.</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium text-foreground">{value}</dd>
    </div>
  );
}
