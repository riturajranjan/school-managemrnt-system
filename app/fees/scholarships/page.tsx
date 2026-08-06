"use client";

import { useState } from "react";
import { Award, Check, Plus, X, XCircle } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef, RowAction } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useFeeStructures, useScholarships } from "@/lib/hooks/use-finance";
import { useStudents } from "@/lib/hooks/use-students";
import { useSisStore } from "@/lib/hooks/use-store";
import { formatMoney } from "@/lib/finance/money";
import { CURRENT_SESSION } from "@/lib/data/seed/reference";
import { approveWaiver, rejectWaiver, requestScholarship, revokeWaiver } from "@/lib/services/waiver-approval-service";
import { approvalWorkflowStatusLabels, scholarshipTypeLabels, type Scholarship, type ScholarshipType } from "@/lib/types/fees";
import { formatDate } from "@/lib/utils";

const ACTOR = { name: "Principal", role: "Principal" };
const typeOptions = Object.keys(scholarshipTypeLabels) as ScholarshipType[];

export default function ScholarshipsPage() {
  const scholarships = useScholarships();
  const students = useStudents();
  const structures = useFeeStructures();
  const db = useSisStore();
  const { can } = usePermissions();
  const canManage = can("fees.manageScholarships");

  const [createOpen, setCreateOpen] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<ScholarshipType>("merit");
  const [percent, setPercent] = useState(15);
  const [error, setError] = useState<string | null>(null);

  function studentName(id: string) {
    const s = students.find((st) => st.id === id);
    return s ? `${s.profile.firstName} ${s.profile.lastName}` : id;
  }

  function applicableComponentIdsFor(sid: string) {
    const assignment = db.studentFeeAssignments.find((a) => a.studentId === sid && a.status === "active");
    const structure = structures.find((s) => s.id === assignment?.structureId);
    return structure?.components.map((c) => c.id) ?? [];
  }

  const columns: ColumnDef<Scholarship>[] = [
    {
      id: "name",
      header: "Scholarship",
      alwaysVisible: true,
      sortValue: (s) => s.name,
      cell: (s) => (
        <div>
          <p className="text-sm font-medium text-foreground">{s.name}</p>
          <p className="text-xs text-muted-foreground">{studentName(s.studentId)}</p>
        </div>
      ),
    },
    { id: "type", header: "Type", cell: (s) => <Badge tone="info">{scholarshipTypeLabels[s.type]}</Badge> },
    { id: "value", header: "Value", cell: (s) => <span className="text-sm text-foreground">{s.percent ? `${s.percent}%` : s.amount ? formatMoney(s.amount) : "—"}</span> },
    { id: "renewable", header: "Renewable", cell: (s) => <span className="text-sm text-muted-foreground">{s.renewable ? "Yes" : "No"}</span>, defaultVisible: false },
    { id: "effective", header: "Effective from", cell: (s) => <span className="text-sm text-muted-foreground">{formatDate(s.effectiveFrom)}</span>, defaultVisible: false },
    {
      id: "status",
      header: "Status",
      align: "right",
      cell: (s) => <Badge tone={s.status === "active" ? "success" : s.status === "rejected" || s.status === "revoked" ? "error" : "neutral"}>{approvalWorkflowStatusLabels[s.status]}</Badge>,
    },
  ];

  const rowActions: RowAction<Scholarship>[] = canManage
    ? [
        { key: "approve", label: "Approve", icon: <Check className="size-3.5" />, hidden: (s) => s.status !== "submitted" && s.status !== "under-review", onSelect: (s) => approveWaiver("scholarship", s.id, ACTOR) },
        { key: "reject", label: "Reject", icon: <X className="size-3.5" />, hidden: (s) => s.status !== "submitted" && s.status !== "under-review", onSelect: (s) => rejectWaiver("scholarship", s.id, "Not approved", ACTOR) },
        { key: "revoke", label: "Revoke", icon: <XCircle className="size-3.5" />, hidden: (s) => s.status !== "active", destructive: true, onSelect: (s) => revokeWaiver("scholarship", s.id, "Revoked", ACTOR) },
      ]
    : [];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Scholarships</h1>
          <p className="text-xs text-muted-foreground">Merit, need-based, sports and sponsored scholarships</p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" />
            Request scholarship
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={scholarships}
        getRowId={(s) => s.id}
        caption="Scholarships"
        rowActions={rowActions}
        renderMobileCard={(s) => (
          <div className="surface-3d flex flex-col gap-1 rounded-lg border border-border bg-surface p-sm">
            <div className="flex items-center justify-between gap-xs">
              <p className="truncate text-sm font-semibold text-foreground">{s.name}</p>
              <Badge tone={s.status === "active" ? "success" : "neutral"}>{approvalWorkflowStatusLabels[s.status]}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {studentName(s.studentId)} · {s.percent ? `${s.percent}%` : s.amount ? formatMoney(s.amount) : "—"}
            </p>
          </div>
        )}
        emptyIcon={Award}
        emptyTitle="No scholarships recorded"
      />

      <DetailDrawer
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setError(null);
        }}
        title="Request a scholarship"
        description="Submitted for approval before it reduces the student's fee items"
      >
        <div className="flex flex-col gap-sm">
          {error && <p className="text-xs text-error">{error}</p>}
          <div>
            <Label>Student</Label>
            <Select value={studentId} onValueChange={setStudentId}>
              <SelectTrigger aria-label="Student">
                <SelectValue placeholder="Select student" />
              </SelectTrigger>
              <SelectContent>
                {students
                  .filter((s) => s.status === "active")
                  .slice(0, 100)
                  .map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.profile.firstName} {s.profile.lastName}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="schol-name">Name</Label>
            <Input id="schol-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Academic merit scholarship" />
          </div>
          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as ScholarshipType)}>
              <SelectTrigger aria-label="Scholarship type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {typeOptions.map((t) => (
                  <SelectItem key={t} value={t}>
                    {scholarshipTypeLabels[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="schol-percent">Percent off</Label>
            <Input id="schol-percent" type="number" min={0} max={100} value={percent} onChange={(e) => setPercent(Number(e.target.value))} />
          </div>
          <Button
            disabled={!studentId || !name.trim()}
            onClick={() => {
              const result = requestScholarship({ studentId, name: name.trim(), type, percent, applicableComponentIds: applicableComponentIdsFor(studentId), session: CURRENT_SESSION, effectiveFrom: new Date().toISOString() }, ACTOR);
              if (!result.ok) {
                setError(result.errors.join(" "));
                return;
              }
              setCreateOpen(false);
              setName("");
              setStudentId("");
            }}
          >
            Submit for approval
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
