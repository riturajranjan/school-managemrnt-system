"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, LogOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmployeeAvatar } from "@/components/hr/employee-avatar";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { toggleClearance } from "@/lib/services/hr-service";
import { roleLabels } from "@/lib/permissions/roles";
import { offboardingStatusLabels, type OffboardingStatus } from "@/lib/types/hr";
import { formatDate } from "@/lib/utils";

const tone: Record<OffboardingStatus, "success" | "warning" | "info" | "neutral"> = {
  initiated: "info",
  "notice-period": "warning",
  "clearance-pending": "warning",
  "final-settlement": "info",
  completed: "success",
};

export default function OffboardingPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [, force] = useState(0);
  if (!can("hr.view")) return <PermissionDenied action="view offboarding" role={roleLabels[role]} backHref="/hr" />;
  const canManage = can("hr.manageOnboarding") || can("hr.manageStaff");

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Offboarding</h1>
        <p className="text-xs text-muted-foreground">Controlled exits, clearance and final settlement</p>
      </div>

      {db.offboardingCases.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
          <LogOut className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No active offboarding cases.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-md">
          {db.offboardingCases.map((c) => {
            const emp = db.employees.find((e) => e.id === c.employeeId);
            const cleared = c.clearances.filter((x) => x.cleared).length;
            return (
              <div key={c.id} className="rounded-lg border border-border bg-surface p-md">
                <div className="mb-sm flex items-center justify-between gap-sm">
                  <Link href={`/hr/staff/${c.employeeId}`} className="flex min-w-0 items-center gap-sm">
                    {emp && <EmployeeAvatar firstName={emp.firstName} lastName={emp.lastName} color={emp.photoColor} size="sm" />}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{emp ? `${emp.firstName} ${emp.lastName}` : c.employeeId}</p>
                      <p className="text-xs text-muted-foreground">{c.reason} · last day {formatDate(c.lastWorkingDate)}</p>
                    </div>
                  </Link>
                  <Badge tone={tone[c.status]}>{offboardingStatusLabels[c.status]}</Badge>
                </div>
                <p className="mb-xs text-xs text-muted-foreground">Clearance {cleared}/{c.clearances.length}</p>
                <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                  {c.clearances.map((cl) => (
                    <button
                      key={cl.key}
                      type="button"
                      disabled={!canManage}
                      onClick={() => { toggleClearance(c.id, cl.key); force((n) => n + 1); }}
                      className={`flex items-center gap-2 rounded-md border p-sm text-left text-sm transition-colors ${cl.cleared ? "border-success/30 bg-success/8" : "border-border"} ${canManage ? "hover:border-primary/40" : "cursor-default"}`}
                    >
                      <span className={`flex size-4 shrink-0 items-center justify-center rounded-full border ${cl.cleared ? "border-success bg-success text-white" : "border-border"}`}>{cl.cleared && <Check className="size-3" />}</span>
                      <span className={cl.cleared ? "text-muted-foreground" : "text-foreground"}>{cl.label}</span>
                    </button>
                  ))}
                </div>
                <p className="mt-sm text-xs text-muted-foreground">Exit interview: {c.exitInterviewDone ? "Completed" : "Pending"}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
