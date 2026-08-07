"use client";

import Link from "next/link";
import { useState } from "react";
import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmployeeAvatar } from "@/components/hr/employee-avatar";
import { RecruitmentPipeline } from "@/components/hr/recruitment-pipeline";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { CANDIDATE_PIPELINE, candidateStageLabels, type CandidateStage } from "@/lib/types/hr";
import { formatDate } from "@/lib/utils";

export default function CandidatesPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [stage, setStage] = useState<CandidateStage | null>(null);

  if (!can("hr.view") && !can("hr.manageRecruitment")) return <PermissionDenied action="view candidates" role={roleLabels[role]} backHref="/hr" />;

  const counts = CANDIDATE_PIPELINE.reduce((acc, s) => { acc[s] = db.candidates.filter((c) => c.stage === s).length; return acc; }, {} as Record<CandidateStage, number>);
  const rows = stage ? db.candidates.filter((c) => c.stage === stage) : db.candidates;
  const jobTitle = (id: string) => db.recruitmentJobs.find((j) => j.id === id)?.title ?? "—";

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Candidates</h1>
        <p className="text-xs text-muted-foreground">{db.candidates.length} candidates · tap a stage to filter</p>
      </div>

      <RecruitmentPipeline counts={counts} activeStage={stage ?? undefined} onSelect={(s) => setStage((prev) => (prev === s ? null : s))} />

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
          <Users className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No candidates in this stage.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
          {rows.map((c) => (
            <Link key={c.id} href={`/hr/recruitment/candidates/${c.id}`} className="surface-3d flex items-center gap-sm rounded-lg border border-border bg-surface p-sm hover:border-primary/40">
              <EmployeeAvatar firstName={c.firstName} lastName={c.lastName} color="#7c3aed" size="md" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-xs">
                  <p className="truncate text-sm font-semibold text-foreground">{c.firstName} {c.lastName}</p>
                  <Badge tone={c.stage === "rejected" ? "error" : c.stage === "hired" ? "success" : "info"}>{candidateStageLabels[c.stage]}</Badge>
                </div>
                <p className="truncate text-xs text-muted-foreground">{jobTitle(c.jobId)} · {c.experienceYears} yrs</p>
                <p className="text-xs text-muted-foreground">{c.source} · applied {formatDate(c.appliedAt)}{c.score ? ` · score ${c.score}` : ""}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
