"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmployeeAvatar } from "@/components/hr/employee-avatar";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { toggleOnboardingTask } from "@/lib/services/hr-service";
import { roleLabels } from "@/lib/permissions/roles";

export default function OnboardingPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [, force] = useState(0);
  if (!can("hr.view")) return <PermissionDenied action="view onboarding" role={roleLabels[role]} backHref="/hr" />;
  const canManage = can("hr.manageOnboarding");

  const employeeIds = [...new Set(db.onboardingTasks.map((t) => t.employeeId))];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Onboarding</h1>
        <p className="text-xs text-muted-foreground">New-joiner journeys and checklist progress</p>
      </div>

      {employeeIds.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
          <UserPlus className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No employees are currently onboarding.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-md">
          {employeeIds.map((eid) => {
            const emp = db.employees.find((e) => e.id === eid);
            if (!emp) return null;
            const tasks = db.onboardingTasks.filter((t) => t.employeeId === eid);
            const done = tasks.filter((t) => t.completed).length;
            const percent = Math.round((done / tasks.length) * 100);
            return (
              <div key={eid} className="rounded-lg border border-border bg-surface p-md">
                <div className="mb-sm flex items-center justify-between gap-sm">
                  <Link href={`/hr/staff/${emp.id}`} className="flex min-w-0 items-center gap-sm">
                    <EmployeeAvatar firstName={emp.firstName} lastName={emp.lastName} color={emp.photoColor} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{emp.firstName} {emp.lastName}</p>
                      <p className="text-xs text-muted-foreground">{db.designations.find((d) => d.id === emp.designationId)?.title}</p>
                    </div>
                  </Link>
                  <Badge tone={percent === 100 ? "success" : percent >= 50 ? "info" : "warning"}>{percent}%</Badge>
                </div>
                <div className="mb-sm h-1.5 w-full overflow-hidden rounded-pill bg-surface-secondary">
                  <div className="h-full rounded-pill bg-primary transition-[width]" style={{ width: `${percent}%` }} />
                </div>
                <ol className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                  {tasks.map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        disabled={!canManage}
                        onClick={() => { toggleOnboardingTask(t.id); force((n) => n + 1); }}
                        className={`flex w-full items-center gap-2 rounded-md border p-sm text-left text-sm transition-colors ${t.completed ? "border-success/30 bg-success/8" : "border-border"} ${canManage ? "hover:border-primary/40" : "cursor-default"}`}
                      >
                        <span className={`flex size-4 shrink-0 items-center justify-center rounded-full border ${t.completed ? "border-success bg-success text-white" : "border-border"}`}>{t.completed && <Check className="size-3" />}</span>
                        <span className={t.completed ? "text-muted-foreground line-through" : "text-foreground"}>{t.label}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
