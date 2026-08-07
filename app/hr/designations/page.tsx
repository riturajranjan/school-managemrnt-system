"use client";

import { BadgeCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { employmentTypeLabels } from "@/lib/types/hr";

export default function DesignationsPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  if (!can("hr.view")) return <PermissionDenied action="view designations" role={roleLabels[role]} backHref="/hr" />;

  const deptName = (id: string) => db.departments.find((d) => d.id === id)?.name ?? "—";
  const byLevel = [...db.designations].sort((a, b) => a.level - b.level);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Designations</h1>
        <p className="text-xs text-muted-foreground">Roles ordered by level — level 1 is most senior</p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="p-sm font-semibold">Designation</th>
              <th className="p-sm font-semibold">Department</th>
              <th className="p-sm text-center font-semibold">Level</th>
              <th className="p-sm font-semibold">Default type</th>
              <th className="p-sm text-right font-semibold">Staff</th>
              <th className="p-sm text-right font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {byLevel.map((d) => {
              const count = db.employees.filter((e) => e.designationId === d.id).length;
              return (
                <tr key={d.id} className="border-b border-border last:border-0">
                  <td className="p-sm">
                    <span className="flex items-center gap-2">
                      <span className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary"><BadgeCheck className="size-3.5" /></span>
                      <span className="font-medium text-foreground">{d.title}</span>
                      <span className="text-xs text-muted-foreground">{d.code}</span>
                    </span>
                  </td>
                  <td className="p-sm text-muted-foreground">{deptName(d.departmentId)}</td>
                  <td className="p-sm text-center"><Badge tone="neutral">L{d.level}</Badge></td>
                  <td className="p-sm text-muted-foreground">{employmentTypeLabels[d.defaultEmploymentType]}</td>
                  <td className="p-sm text-right font-medium text-foreground">{count}</td>
                  <td className="p-sm text-right"><Badge tone={d.status === "active" ? "success" : "neutral"}>{d.status}</Badge></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
