"use client";

import { useState } from "react";
import { Check, Gift, Plus, X, XCircle } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef, RowAction } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useConcessions, useFeeStructures } from "@/lib/hooks/use-finance";
import { useStudents } from "@/lib/hooks/use-students";
import { useSisStore } from "@/lib/hooks/use-store";
import { formatMoney, moneyFromMajor } from "@/lib/finance/money";
import { approveWaiver, rejectWaiver, requestConcession, revokeWaiver } from "@/lib/services/waiver-approval-service";
import { approvalWorkflowStatusLabels, concessionReasonLabels, type Concession, type ConcessionReason } from "@/lib/types/fees";
import { formatDate } from "@/lib/utils";

const ACTOR = { name: "Principal", role: "Principal" };
const reasonOptions = Object.keys(concessionReasonLabels) as ConcessionReason[];

export default function ConcessionsPage() {
  const concessions = useConcessions();
  const students = useStudents();
  const structures = useFeeStructures();
  const db = useSisStore();
  const { can } = usePermissions();
  const canManage = can("fees.manageConcessions");

  const [createOpen, setCreateOpen] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [reason, setReason] = useState<ConcessionReason>("financial-hardship");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState(1000);
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

  const columns: ColumnDef<Concession>[] = [
    {
      id: "description",
      header: "Concession",
      alwaysVisible: true,
      sortValue: (c) => c.description,
      cell: (c) => (
        <div>
          <p className="text-sm font-medium text-foreground">{c.description}</p>
          <p className="text-xs text-muted-foreground">{studentName(c.studentId)}</p>
        </div>
      ),
    },
    { id: "reason", header: "Reason", cell: (c) => <Badge tone="info">{concessionReasonLabels[c.reason]}</Badge> },
    { id: "amount", header: "Amount", cell: (c) => <span className="text-sm text-foreground">{formatMoney(c.amount)}</span> },
    { id: "effective", header: "Effective from", cell: (c) => <span className="text-sm text-muted-foreground">{formatDate(c.effectiveFrom)}</span>, defaultVisible: false },
    {
      id: "status",
      header: "Status",
      align: "right",
      cell: (c) => <Badge tone={c.status === "active" ? "success" : c.status === "rejected" || c.status === "revoked" ? "error" : "neutral"}>{approvalWorkflowStatusLabels[c.status]}</Badge>,
    },
  ];

  const rowActions: RowAction<Concession>[] = canManage
    ? [
        { key: "approve", label: "Approve", icon: <Check className="size-3.5" />, hidden: (c) => c.status !== "submitted" && c.status !== "under-review", onSelect: (c) => approveWaiver("concession", c.id, ACTOR) },
        { key: "reject", label: "Reject", icon: <X className="size-3.5" />, hidden: (c) => c.status !== "submitted" && c.status !== "under-review", onSelect: (c) => rejectWaiver("concession", c.id, "Not approved", ACTOR) },
        { key: "revoke", label: "Revoke", icon: <XCircle className="size-3.5" />, hidden: (c) => c.status !== "active", destructive: true, onSelect: (c) => revokeWaiver("concession", c.id, "Revoked", ACTOR) },
      ]
    : [];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Concessions</h1>
          <p className="text-xs text-muted-foreground">Hardship, medical and management-approved fee relief</p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" />
            Request concession
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={concessions}
        getRowId={(c) => c.id}
        caption="Concessions"
        rowActions={rowActions}
        renderMobileCard={(c) => (
          <div className="surface-3d flex flex-col gap-1 rounded-lg border border-border bg-surface p-sm">
            <div className="flex items-center justify-between gap-xs">
              <p className="truncate text-sm font-semibold text-foreground">{c.description}</p>
              <Badge tone={c.status === "active" ? "success" : "neutral"}>{approvalWorkflowStatusLabels[c.status]}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {studentName(c.studentId)} · {formatMoney(c.amount)}
            </p>
          </div>
        )}
        emptyIcon={Gift}
        emptyTitle="No concessions recorded"
      />

      <DetailDrawer
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setError(null);
        }}
        title="Request a concession"
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
            <Label>Reason</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as ConcessionReason)}>
              <SelectTrigger aria-label="Reason">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {reasonOptions.map((r) => (
                  <SelectItem key={r} value={r}>
                    {concessionReasonLabels[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="conc-desc">Description</Label>
            <Input id="conc-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Context for the approver" />
          </div>
          <div>
            <Label htmlFor="conc-amount">Amount (₹)</Label>
            <Input id="conc-amount" type="number" min={0} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </div>
          <Button
            disabled={!studentId || !description.trim()}
            onClick={() => {
              const result = requestConcession(
                { studentId, reason, description: description.trim(), amount: moneyFromMajor(amount, "INR"), applicableComponentIds: applicableComponentIdsFor(studentId), effectiveFrom: new Date().toISOString() },
                ACTOR,
              );
              if (!result.ok) {
                setError(result.errors.join(" "));
                return;
              }
              setCreateOpen(false);
              setDescription("");
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
