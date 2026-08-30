"use client";

// Employee Onboarding (Production migration, Phase B, HR Sub-batch 4) — real
// PostgreSQL/API cutover. NOT SchoolOnboarding (platform-side) — this is a
// new employee's own checklist, always tied to a real Staff.id.
// Onboarding 1→many OnboardingTask; progress is always derived live from
// real task completion, never a stored percentage. hr.view/hr.manage RBAC —
// no new permission.
import Link from "next/link";
import { Check, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { completeOnboardingTaskRequest, reopenOnboardingTaskRequest, useEmployeeOnboardings } from "@/lib/hooks/api/use-hr-api";
import { roleLabels } from "@/lib/permissions/roles";
import type { EmployeeOnboardingStatusDto } from "@/lib/api/contracts";
import { formatDate } from "@/lib/utils";

const statusLabels: Record<EmployeeOnboardingStatusDto, string> = {
  "not-started": "Not started", "in-progress": "In progress", completed: "Completed", cancelled: "Cancelled",
};
const statusTone: Record<EmployeeOnboardingStatusDto, "success" | "warning" | "error" | "neutral" | "info"> = {
  "not-started": "neutral", "in-progress": "info", completed: "success", cancelled: "error",
};

export default function OnboardingPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: onboardings, loading, error, reload } = useEmployeeOnboardings();

  if (!capabilitiesLoading && !hasServerPermission("hr.view") && !hasServerPermission("hr.manage")) {
    return <PermissionDenied action="view onboarding" role={roleLabels[role]} backHref="/hr" />;
  }
  const canManage = hasServerPermission("hr.manage");

  const active = onboardings.filter((o) => o.status === "not-started" || o.status === "in-progress");

  async function toggleTask(taskId: string, completed: boolean) {
    if (completed) await reopenOnboardingTaskRequest(taskId);
    else await completeOnboardingTaskRequest(taskId);
    reload();
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Onboarding</h1>
        <p className="text-xs text-muted-foreground">New-joiner journeys and real checklist progress</p>
      </div>

      {error && <div className="rounded-lg border border-error/30 bg-error/5 p-md text-sm text-error" role="alert">Could not load onboarding: {error}</div>}

      {loading && onboardings.length === 0 ? (
        <p className="py-2xl text-center text-sm text-muted-foreground">Loading onboarding…</p>
      ) : active.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
          <UserPlus className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No employees are currently onboarding.</p>
          <p className="text-xs text-muted-foreground">Start onboarding a SELECTED recruitment applicant from <Link href="/hr/recruitment" className="text-primary hover:underline">Recruitment</Link>.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-md">
          {active.map((ob) => (
            <div key={ob.id} className="rounded-lg border border-border bg-surface p-md">
              <div className="mb-sm flex items-center justify-between gap-sm">
                <Link href={`/hr/staff/${ob.staffId}`} className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground hover:underline">{ob.staffName} <span className="font-normal text-muted-foreground">· {ob.employeeCode}</span></p>
                  <p className="text-xs text-muted-foreground">Started {formatDate(ob.startDate)}{ob.hrOwnerName ? ` · Owner: ${ob.hrOwnerName}` : ""}</p>
                </Link>
                <div className="flex items-center gap-xs">
                  <Badge tone={statusTone[ob.status]}>{statusLabels[ob.status]}</Badge>
                  <Badge tone={ob.progressPercent === 100 ? "success" : ob.progressPercent >= 50 ? "info" : "warning"}>{ob.progressPercent}%</Badge>
                </div>
              </div>
              <div className="mb-sm h-1.5 w-full overflow-hidden rounded-pill bg-surface-secondary">
                <div className="h-full rounded-pill bg-primary transition-[width]" style={{ width: `${ob.progressPercent}%` }} />
              </div>
              <ol className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {ob.tasks.map((t) => {
                  const completed = t.status === "completed";
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        disabled={!canManage}
                        onClick={() => toggleTask(t.id, completed)}
                        className={`flex w-full items-center gap-2 rounded-md border p-sm text-left text-sm transition-colors ${completed ? "border-success/30 bg-success/8" : "border-border"} ${canManage ? "hover:border-primary/40" : "cursor-default"}`}
                      >
                        <span className={`flex size-4 shrink-0 items-center justify-center rounded-full border ${completed ? "border-success bg-success text-white" : "border-border"}`}>{completed && <Check className="size-3" />}</span>
                        <span className={completed ? "text-muted-foreground line-through" : "text-foreground"}>{t.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
