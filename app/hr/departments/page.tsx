"use client";

// Departments (Phase 9P) — real PostgreSQL/API cutover. Real Department
// master + real Staff counts/head — no fake openings (recruitment) or
// per-department attendance average (no real basis for that aggregate yet).
import Link from "next/link";
import { useState } from "react";
import { Network, Plus, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { createDepartmentRequest, setDepartmentStatusRequest, useDepartments } from "@/lib/hooks/api/use-hr-api";
import { useStaffList } from "@/lib/hooks/api/use-staff-api";
import { roleLabels } from "@/lib/permissions/roles";

export default function DepartmentsPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: departments, reload } = useDepartments();
  const { data: staff } = useStaffList({ status: "active", pageSize: 500 });
  const [createOpen, setCreateOpen] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [headStaffId, setHeadStaffId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  if (!capabilitiesLoading && !hasServerPermission("hr.view")) return <PermissionDenied action="view departments" role={roleLabels[role]} backHref="/hr" />;
  const canManage = hasServerPermission("hr.manage");

  async function submit() {
    setError(null);
    if (!code.trim() || !name.trim()) return setError("Code and name are required.");
    const res = await createDepartmentRequest({ code: code.trim(), name: name.trim(), headStaffId: headStaffId || undefined });
    if (!res.success) return setError(res.error.message);
    setCode(""); setName(""); setHeadStaffId(""); setCreateOpen(false);
    reload();
  }

  async function archive(id: string) {
    setBusyId(id);
    await setDepartmentStatusRequest(id, "archived");
    setBusyId(null);
    reload();
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Departments</h1>
          <p className="text-xs text-muted-foreground">{departments.length} departments · real staffing</p>
        </div>
        <div className="flex gap-xs">
          <Button asChild size="sm" variant="outline"><Link href="/hr/org-chart"><Network className="size-3.5" /> Org chart</Link></Button>
          {canManage && <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="size-3.5" /> Add department</Button>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2 lg:grid-cols-3">
        {departments.map((dept) => (
          <div key={dept.id} className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
            <div className="flex items-start justify-between gap-sm">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{dept.name}</p>
                <p className="truncate text-xs text-muted-foreground">Head: {dept.headStaffName ?? "Unassigned"}</p>
              </div>
              <Badge tone={dept.status === "active" ? "neutral" : "warning"}>{dept.code}</Badge>
            </div>
            <div className="grid grid-cols-1 gap-sm text-center">
              <div className="rounded-md border border-border p-sm">
                <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground"><Users className="size-3" /> Staff</p>
                <p className="text-sm font-semibold text-foreground">{dept.staffCount}</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Link href={`/hr/staff?departmentId=${dept.id}`} className="text-xs font-medium text-primary">View staff →</Link>
              {canManage && dept.status === "active" && (
                <Button size="sm" variant="ghost" disabled={busyId === dept.id} onClick={() => archive(dept.id)}>Archive</Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <DetailDrawer open={createOpen} onOpenChange={setCreateOpen} title="Add department" description="Create a real department">
        <div className="flex flex-col gap-md">
          <div>
            <Label htmlFor="dept-code">Code</Label>
            <Input id="dept-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. SCI" />
          </div>
          <div>
            <Label htmlFor="dept-name">Name</Label>
            <Input id="dept-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Science" />
          </div>
          <div>
            <Label htmlFor="dept-head">Head of department (optional)</Label>
            <Select value={headStaffId} onValueChange={setHeadStaffId}>
              <SelectTrigger id="dept-head"><SelectValue placeholder="Select staff" /></SelectTrigger>
              <SelectContent>{staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {error && <p className="text-sm text-error">{error}</p>}
          <Button onClick={submit}>Create department</Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
