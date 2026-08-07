"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarDays, Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmployeeAvatar } from "@/components/hr/employee-avatar";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { applyLeave, reviewLeave } from "@/lib/services/hr-service";
import { roleLabels } from "@/lib/permissions/roles";
import { hrLeaveStatusTone, hrLeaveTypeLabels, type HrLeaveType } from "@/lib/types/hr";
import { formatDate } from "@/lib/utils";

const HR_REVIEWER = "emp-3";

export default function LeavePage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [empId, setEmpId] = useState(db.employees[0]?.id ?? "");
  const [type, setType] = useState<HrLeaveType>("casual");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [, force] = useState(0);

  if (!can("hr.view")) return <PermissionDenied action="view leave" role={roleLabels[role]} backHref="/hr" />;
  const canApprove = can("hr.approveLeave");
  const canManage = can("hr.manageLeave");

  const pending = db.hrLeaveRequests.filter((r) => r.status === "pending");
  const others = db.hrLeaveRequests.filter((r) => r.status !== "pending").slice(0, 20);
  const empName = (id: string) => { const e = db.employees.find((x) => x.id === id); return e ? `${e.firstName} ${e.lastName}` : id; };
  const emp = (id: string) => db.employees.find((x) => x.id === id);

  function submit() {
    setError(null);
    if (!start || !end) return setError("Select start and end dates.");
    if (!reason.trim()) return setError("A reason is required.");
    const r = applyLeave({ employeeId: empId, leaveType: type, startDate: start, endDate: end, halfDay: false, reason });
    if (!r.ok) return setError(r.error);
    setStart(""); setEnd(""); setReason("");
    force((n) => n + 1);
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Leave management</h1>
          <p className="text-xs text-muted-foreground">{pending.length} pending request(s)</p>
        </div>
        <Button asChild size="sm" variant="outline"><Link href="/hr/leave/calendar"><CalendarDays className="size-3.5" /> Calendar</Link></Button>
      </div>

      {canManage && (
        <div className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
          <h2 className="text-sm font-semibold text-foreground">Record leave</h2>
          <div className="grid grid-cols-1 gap-sm sm:grid-cols-5">
            <Select value={empId} onValueChange={setEmpId}>
              <SelectTrigger aria-label="Employee"><SelectValue /></SelectTrigger>
              <SelectContent>{db.employees.slice(0, 60).map((e) => <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={type} onValueChange={(v) => setType(v as HrLeaveType)}>
              <SelectTrigger aria-label="Leave type"><SelectValue /></SelectTrigger>
              <SelectContent>{(Object.keys(hrLeaveTypeLabels) as HrLeaveType[]).map((t) => <SelectItem key={t} value={t}>{hrLeaveTypeLabels[t]}</SelectItem>)}</SelectContent>
            </Select>
            <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} aria-label="Start date" />
            <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} aria-label="End date" />
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason" aria-label="Reason" />
          </div>
          {error && <p className="rounded-md border border-error/30 bg-error/8 p-sm text-sm text-error">{error}</p>}
          <div className="flex justify-end"><Button size="sm" onClick={submit}>Submit request</Button></div>
        </div>
      )}

      <section>
        <h2 className="mb-sm text-sm font-semibold text-foreground">Pending approvals ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No pending requests.</p>
        ) : (
          <div className="flex flex-col gap-sm">
            {pending.map((r) => {
              const e = emp(r.employeeId);
              return (
                <div key={r.id} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
                  <div className="flex min-w-0 items-center gap-sm">
                    {e && <EmployeeAvatar firstName={e.firstName} lastName={e.lastName} color={e.photoColor} size="sm" />}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{empName(r.employeeId)}</p>
                      <p className="truncate text-xs text-muted-foreground">{hrLeaveTypeLabels[r.leaveType]} · {formatDate(r.startDate)} · {r.days}d · {r.reason}</p>
                    </div>
                  </div>
                  {canApprove ? (
                    <div className="flex shrink-0 gap-xs">
                      <Button size="sm" variant="outline" onClick={() => { reviewLeave(r.id, "approved", HR_REVIEWER); force((n) => n + 1); }}><Check className="size-3.5" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => { reviewLeave(r.id, "rejected", HR_REVIEWER, "Coverage unavailable"); force((n) => n + 1); }}><X className="size-3.5" /></Button>
                    </div>
                  ) : (
                    <Badge tone="warning">Pending</Badge>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {others.length > 0 && (
        <section>
          <h2 className="mb-sm text-sm font-semibold text-foreground">Recent decisions</h2>
          <div className="flex flex-col gap-xs">
            {others.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-sm rounded-md border border-border bg-surface p-sm text-sm">
                <span className="min-w-0 truncate text-foreground">{empName(r.employeeId)} · {hrLeaveTypeLabels[r.leaveType]}</span>
                <Badge tone={hrLeaveStatusTone[r.status]}>{r.status}</Badge>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
