"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmployeeAvatar } from "@/components/hr/employee-avatar";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { contractStatusLabels, employmentTypeLabels, type ContractStatus } from "@/lib/types/hr";
import { formatDate } from "@/lib/utils";

const tone: Record<ContractStatus, "success" | "warning" | "error" | "neutral" | "info"> = {
  draft: "neutral",
  active: "success",
  expiring: "warning",
  "renewal-pending": "warning",
  expired: "error",
  terminated: "neutral",
};

export default function ContractsPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [filter, setFilter] = useState<"attention" | "all">("attention");
  if (!can("hr.view")) return <PermissionDenied action="view contracts" role={roleLabels[role]} backHref="/hr" />;

  const emp = (id: string) => db.employees.find((e) => e.id === id);
  const attention = db.contracts.filter((c) => c.status === "expiring" || c.status === "renewal-pending" || c.status === "expired");
  const rows = filter === "attention" ? attention : db.contracts;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Contracts</h1>
          <p className="text-xs text-muted-foreground">{attention.length} contract(s) need attention</p>
        </div>
        <div className="inline-flex rounded-md border border-border p-0.5">
          {(["attention", "all"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`rounded px-sm py-1.5 text-xs font-medium capitalize ${filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{f}</button>
          ))}
        </div>
      </div>

      {attention.length > 0 && filter === "attention" && (
        <div className="flex items-center gap-sm rounded-md border border-warning/30 bg-warning/8 p-sm text-sm text-warning">
          <AlertTriangle className="size-4" /> {attention.length} contract(s) expiring or expired — review renewals.
        </div>
      )}

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
          <FileText className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No contracts to show.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-sm">
          {rows.slice(0, 60).map((c) => {
            const e = emp(c.employeeId);
            return (
              <Link key={c.id} href={`/hr/staff/${c.employeeId}`} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm hover:border-primary/40">
                <div className="flex min-w-0 items-center gap-sm">
                  {e && <EmployeeAvatar firstName={e.firstName} lastName={e.lastName} color={e.photoColor} size="sm" />}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{e ? `${e.firstName} ${e.lastName}` : c.employeeId}</p>
                    <p className="truncate text-xs text-muted-foreground">{c.type === "custom" ? "Custom" : employmentTypeLabels[c.type]} · {c.endDate ? `ends ${formatDate(c.endDate)}` : "no end date"}</p>
                  </div>
                </div>
                <Badge tone={tone[c.status]}>{contractStatusLabels[c.status]}</Badge>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
