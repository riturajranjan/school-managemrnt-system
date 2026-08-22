"use client";

// Designations (Phase 9P) — real PostgreSQL/API cutover. `level` is a plain
// optional sort/display order, never a promotion or hierarchy policy.
import { useState } from "react";
import { BadgeCheck, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { createDesignationRequest, useDepartments, useDesignations } from "@/lib/hooks/api/use-hr-api";
import { roleLabels } from "@/lib/permissions/roles";

const NONE = "__none__";

export default function DesignationsPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: designations, reload } = useDesignations();
  const { data: departments } = useDepartments({ status: "active" });
  const [createOpen, setCreateOpen] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [departmentId, setDepartmentId] = useState(NONE);
  const [level, setLevel] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!capabilitiesLoading && !hasServerPermission("hr.view")) return <PermissionDenied action="view designations" role={roleLabels[role]} backHref="/hr" />;
  const canManage = hasServerPermission("hr.manage");

  const byLevel = [...designations].sort((a, b) => (a.level ?? 999) - (b.level ?? 999));

  async function submit() {
    setError(null);
    if (!code.trim() || !name.trim()) return setError("Code and name are required.");
    const res = await createDesignationRequest({
      code: code.trim(), name: name.trim(),
      departmentId: departmentId !== NONE ? departmentId : undefined,
      level: level ? Number(level) : undefined,
    });
    if (!res.success) return setError(res.error.message);
    setCode(""); setName(""); setDepartmentId(NONE); setLevel(""); setCreateOpen(false);
    reload();
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Designations</h1>
          <p className="text-xs text-muted-foreground">Roles, optionally ordered by level — lower is more senior</p>
        </div>
        {canManage && <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="size-3.5" /> Add designation</Button>}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="p-sm font-semibold">Designation</th>
              <th className="p-sm font-semibold">Department</th>
              <th className="p-sm text-center font-semibold">Level</th>
              <th className="p-sm text-right font-semibold">Staff</th>
              <th className="p-sm text-right font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {byLevel.map((d) => (
              <tr key={d.id} className="border-b border-border last:border-0">
                <td className="p-sm">
                  <span className="flex items-center gap-2">
                    <span className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary"><BadgeCheck className="size-3.5" /></span>
                    <span className="font-medium text-foreground">{d.name}</span>
                    <span className="text-xs text-muted-foreground">{d.code}</span>
                  </span>
                </td>
                <td className="p-sm text-muted-foreground">{d.departmentName ?? "—"}</td>
                <td className="p-sm text-center">{d.level !== null ? <Badge tone="neutral">L{d.level}</Badge> : <span className="text-muted-foreground">—</span>}</td>
                <td className="p-sm text-right font-medium text-foreground">{d.staffCount}</td>
                <td className="p-sm text-right"><Badge tone={d.status === "active" ? "success" : "neutral"}>{d.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <DetailDrawer open={createOpen} onOpenChange={setCreateOpen} title="Add designation" description="Create a real designation">
        <div className="flex flex-col gap-md">
          <div>
            <Label htmlFor="desig-code">Code</Label>
            <Input id="desig-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. PGT-MATH" />
          </div>
          <div>
            <Label htmlFor="desig-name">Name</Label>
            <Input id="desig-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. PGT Mathematics" />
          </div>
          <div>
            <Label htmlFor="desig-dept">Department (optional)</Label>
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger id="desig-dept"><SelectValue placeholder="No department" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No department</SelectItem>
                {departments.map((dep) => <SelectItem key={dep.id} value={dep.id}>{dep.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="desig-level">Level (optional, lower = more senior)</Label>
            <Input id="desig-level" type="number" inputMode="numeric" value={level} onChange={(e) => setLevel(e.target.value)} placeholder="e.g. 3" />
          </div>
          {error && <p className="text-sm text-error">{error}</p>}
          <Button onClick={submit}>Create designation</Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
