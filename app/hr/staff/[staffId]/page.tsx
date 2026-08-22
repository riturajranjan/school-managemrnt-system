"use client";

// Staff 360 (Phase 9J; Employment tab + Assets tab now real, Phase 9P) —
// real PostgreSQL/API cutover over the real Staff model + the real domains
// that already exist for it (Staff Attendance, Leave, Assets). Performance/
// Goals/Training/Documents/Timeline/Contract/Qualifications/Bank details
// have no real backing anywhere in the schema — each of those tabs stays on
// the page (no redesign) but shows an honest "not tracked yet" state instead
// of the old mock db.performanceReviews/goals/trainingEnrollments/
// staffDocuments/employeeTimeline/contracts/qualifications/bank fields.
// Salary is never duplicated here — Payroll RBAC (payroll.view) gates a link
// only, never an amount.
import Link from "next/link";
import { use, useState } from "react";
import { ArrowLeft, Archive, CalendarDays, CheckCircle2, HardDrive, Pencil, Wallet, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmployeeAvatar } from "@/components/hr/employee-avatar";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { setStaffStatusRequest, setStaffUserRequest, useStaff } from "@/lib/hooks/api/use-staff-api";
import { useStaffAttendanceDetail } from "@/lib/hooks/api/use-staff-attendance-api";
import { useLeaveRequests } from "@/lib/hooks/api/use-leave-api";
import { useAssetAssignments } from "@/lib/hooks/api/use-assets-api";
import { roleLabels } from "@/lib/permissions/roles";
import type { EmploymentType, StaffStatus } from "@/lib/api/contracts";
import { formatDate } from "@/lib/utils";

const statusLabels: Record<StaffStatus, string> = { active: "Active", inactive: "Inactive", archived: "Archived" };
const statusTone: Record<StaffStatus, "success" | "warning" | "neutral"> = { active: "success", inactive: "warning", archived: "neutral" };
const employmentTypeLabels: Record<EmploymentType, string> = { "full-time": "Full-time", "part-time": "Part-time", contract: "Contract", temporary: "Temporary" };
const leaveStatusTone = { pending: "warning", approved: "success", rejected: "error", cancelled: "neutral" } as const;
const attendanceStatusTone = { present: "success", absent: "error", late: "warning", "half-day": "warning", "on-leave": "info" } as const;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export default function Staff360Page({ params }: { params: Promise<{ staffId: string }> }) {
  const { staffId } = use(params);
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: staff, loading, error, reload } = useStaff(staffId);
  const { data: attendance } = useStaffAttendanceDetail(staffId, daysAgo(90), today());
  const { data: leaves } = useLeaveRequests({ staffId });
  const canViewAssets = hasServerPermission("assets.view");
  const { data: assetAssignments } = useAssetAssignments({ staffId });
  const [linkUserId, setLinkUserId] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);

  if (!capabilitiesLoading && !hasServerPermission("hr.view")) return <PermissionDenied action="view staff profiles" role={roleLabels[role]} backHref="/hr" />;
  if (loading) return <p className="py-2xl text-center text-sm text-muted-foreground">Loading…</p>;
  if (error || !staff) {
    return (
      <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
        <p className="text-sm font-medium text-foreground">{error ?? "Staff member not found"}</p>
        <Button asChild size="sm" variant="outline"><Link href="/hr/staff">Back to directory</Link></Button>
      </div>
    );
  }

  const canManage = hasServerPermission("hr.manage");
  const canPayroll = hasServerPermission("payroll.view");
  const todayAtt = attendance?.history.find((a) => a.date === today());

  async function changeStatus(status: StaffStatus) {
    setStatusBusy(true);
    await setStaffStatusRequest(staff!.id, status);
    setStatusBusy(false);
    reload();
  }

  async function linkUser() {
    if (!linkUserId.trim()) return;
    setLinking(true);
    setLinkError(null);
    const res = await setStaffUserRequest(staff!.id, linkUserId.trim());
    setLinking(false);
    if (!res.success) { setLinkError(res.error.message); return; }
    setLinkUserId("");
    reload();
  }

  async function unlinkUser() {
    setLinking(true);
    await setStaffUserRequest(staff!.id, null);
    setLinking(false);
    reload();
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-sm">
        <Button asChild size="icon" variant="ghost" aria-label="Back"><Link href="/hr/staff"><ArrowLeft className="size-4" /></Link></Button>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold text-foreground">{staff.name}</h1>
          <p className="truncate text-xs text-muted-foreground">{staff.employeeCode} · {staff.designation ?? "—"} · {staff.department ?? "—"}</p>
        </div>
      </div>

      <div className="flex flex-col gap-md rounded-lg border border-border bg-surface p-md sm:flex-row sm:items-start">
        <EmployeeAvatar firstName={staff.name.split(" ")[0] ?? staff.name} lastName={staff.name.split(" ")[1] ?? ""} size="lg" />
        <div className="flex min-w-0 flex-1 flex-col gap-sm">
          <div className="flex flex-wrap items-center gap-xs">
            <Badge tone={statusTone[staff.status]}>{statusLabels[staff.status]}</Badge>
            {staff.employmentType && <Badge tone="neutral">{employmentTypeLabels[staff.employmentType]}</Badge>}
            {staff.isTeaching && <Badge tone="info">Teaching</Badge>}
          </div>
          <div className="grid grid-cols-2 gap-sm text-sm sm:grid-cols-4">
            <Field label="Joined" value={staff.joiningDate ? formatDate(staff.joiningDate) : "—"} />
            <Field label="Attendance (90d)" value={attendance?.percent.percentage != null ? `${attendance.percent.percentage}%` : "—"} />
            <Field label="Email" value={staff.email ?? "—"} />
            <Field label="Phone" value={staff.phone ?? "—"} />
            <Field label="Branch" value={staff.branchId} />
            <Field label="Login account" value={staff.hasUser ? (staff.userEmail ?? "Linked") : "Not linked"} />
          </div>
        </div>
      </div>

      {canManage && (
        <div className="flex flex-wrap gap-xs">
          <Button asChild size="sm" variant="outline"><Link href={`/hr/staff/${staff.id}/edit`}><Pencil className="size-3.5" /> Edit</Link></Button>
          {staff.status !== "active" && <Button size="sm" variant="ghost" disabled={statusBusy} onClick={() => changeStatus("active")}><CheckCircle2 className="size-3.5" /> Activate</Button>}
          {staff.status !== "inactive" && <Button size="sm" variant="ghost" disabled={statusBusy} onClick={() => changeStatus("inactive")}><XCircle className="size-3.5" /> Deactivate</Button>}
          {staff.status !== "archived" && <Button size="sm" variant="ghost" disabled={statusBusy} onClick={() => changeStatus("archived")}><Archive className="size-3.5" /> Archive</Button>}
          <Button asChild size="sm" variant="ghost"><Link href="/hr/leave"><CalendarDays className="size-3.5" /> Leave</Link></Button>
          {canViewAssets && <Button asChild size="sm" variant="ghost"><Link href="/assets/assignments"><HardDrive className="size-3.5" /> Assets</Link></Button>}
          {canPayroll && <Button asChild size="sm" variant="ghost"><Link href="/payroll/payslips"><Wallet className="size-3.5" /> Payroll</Link></Button>}
        </div>
      )}

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="employment">Employment</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="leave">Leave</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="goals">Goals</TabsTrigger>
          <TabsTrigger value="training">Training</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="assets">Assets</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-md">
          <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
            <Card title="Today's attendance status">
              {todayAtt ? <Badge tone={attendanceStatusTone[todayAtt.status]}>{todayAtt.status.replace("-", " ")}</Badge> : <span className="text-sm text-muted-foreground">Not marked</span>}
              {todayAtt?.checkInAt && <p className="mt-1 text-xs text-muted-foreground">In {todayAtt.checkInAt}{todayAtt.checkOutAt ? ` · Out ${todayAtt.checkOutAt}` : ""}</p>}
            </Card>
            <Card title="Login account">
              {staff.hasUser ? (
                <div className="flex items-center justify-between gap-sm">
                  <span className="text-sm text-foreground">{staff.userEmail ?? "Linked"}</span>
                  {canManage && <Button size="sm" variant="outline" disabled={linking} onClick={unlinkUser}>Unlink</Button>}
                </div>
              ) : canManage ? (
                <div className="flex flex-col gap-xs">
                  <div className="flex gap-xs">
                    <Input value={linkUserId} onChange={(e) => setLinkUserId(e.target.value)} placeholder="User ID to link" aria-label="User ID to link" />
                    <Button size="sm" disabled={linking} onClick={linkUser}>Link</Button>
                  </div>
                  {linkError && <p className="text-xs text-error">{linkError}</p>}
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">No login account linked</span>
              )}
            </Card>
            <Card title="Qualifications">
              <span className="text-sm text-muted-foreground">Not tracked in this system yet.</span>
            </Card>
            <Card title="Emergency contact">
              <span className="text-sm text-muted-foreground">Not tracked in this system yet.</span>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="employment" className="mt-md">
          <div className="grid grid-cols-2 gap-sm text-sm sm:grid-cols-3">
            <Field label="Designation" value={staff.designation ?? "—"} />
            <Field label="Department" value={staff.department ?? "—"} />
            <Field label="Employment type" value={staff.employmentType ? employmentTypeLabels[staff.employmentType] : "—"} />
            <Field label="Joining date" value={staff.joiningDate ? formatDate(staff.joiningDate) : "—"} />
            <Field label="Employee code" value={staff.employeeCode} />
            <Field label="Teaching eligible" value={staff.isTeaching ? "Yes" : "No"} />
          </div>
        </TabsContent>

        <TabsContent value="attendance" className="mt-md">
          {!attendance || attendance.history.length === 0 ? <Empty message="No attendance records in the last 90 days." /> : (
            <div className="flex flex-col gap-xs">
              {attendance.history.slice(0, 15).map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-sm rounded-md border border-border bg-surface p-sm text-sm">
                  <span className="text-foreground">{formatDate(a.date)}</span>
                  <div className="flex items-center gap-sm">
                    {a.checkInAt && <span className="text-xs text-muted-foreground">{a.checkInAt}–{a.checkOutAt ?? "—"}</span>}
                    <Badge tone={attendanceStatusTone[a.status]}>{a.status.replace("-", " ")}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="leave" className="mt-md">
          <div className="mb-md rounded-lg border border-dashed border-border bg-surface p-sm text-xs text-muted-foreground">
            Leave balances are not tracked yet — no leave-entitlement policy exists in this system. Requests below are real.
          </div>
          {leaves.length === 0 ? <Empty message="No leave requests." /> : (
            <div className="flex flex-col gap-xs">
              {leaves.map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-sm rounded-md border border-border bg-surface p-sm text-sm">
                  <span className="min-w-0"><span className="text-foreground">{l.leaveTypeName}</span> <span className="text-xs text-muted-foreground">{formatDate(l.startDate)}{l.startDate !== l.endDate ? ` – ${formatDate(l.endDate)}` : ""}</span></span>
                  <Badge tone={leaveStatusTone[l.status]}>{l.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="performance" className="mt-md"><Empty message="Not tracked in this system yet." /></TabsContent>
        <TabsContent value="goals" className="mt-md"><Empty message="Not tracked in this system yet." /></TabsContent>
        <TabsContent value="training" className="mt-md"><Empty message="Not tracked in this system yet." /></TabsContent>
        <TabsContent value="documents" className="mt-md"><Empty message="Not tracked in this system yet." /></TabsContent>
        <TabsContent value="assets" className="mt-md">
          {!canViewAssets ? (
            <Empty message="You do not have permission to view asset assignments." />
          ) : assetAssignments.length === 0 ? (
            <Empty message="No assets assigned." />
          ) : (
            <div className="flex flex-col gap-xs">
              {assetAssignments.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-sm rounded-md border border-border bg-surface p-sm text-sm">
                  <div className="min-w-0">
                    <Link href={`/assets/${a.assetId}`} className="truncate font-medium text-foreground hover:underline">{a.assetName}</Link>
                    <p className="text-xs text-muted-foreground">{a.assetTag} · since {formatDate(a.assignedAt)}{a.returnedAt ? ` · returned ${formatDate(a.returnedAt)}` : ""}</p>
                  </div>
                  <Badge tone={a.status === "active" ? "info" : "neutral"}>{a.status === "active" ? "Active" : "Returned"}</Badge>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="timeline" className="mt-md"><Empty message="Not tracked in this system yet." /></TabsContent>
      </Tabs>
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

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-md">
      <h3 className="mb-sm text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </div>
  );
}

function Empty({ message }: { message: string }) {
  return <div className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">{message}</div>;
}
