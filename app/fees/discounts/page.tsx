"use client";

import { useState } from "react";
import { Check, Coins, Plus, X, XCircle } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef, RowAction } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useDiscounts, useFeeStructures } from "@/lib/hooks/use-finance";
import { useStudents } from "@/lib/hooks/use-students";
import { useSisStore } from "@/lib/hooks/use-store";
import { formatMoney } from "@/lib/finance/money";
import { CURRENT_SESSION } from "@/lib/data/seed/reference";
import { approveWaiver, rejectWaiver, requestDiscount, revokeWaiver } from "@/lib/services/waiver-approval-service";
import { approvalWorkflowStatusLabels, discountTypeLabels, type Discount, type DiscountType } from "@/lib/types/fees";
import { formatDate } from "@/lib/utils";

const ACTOR = { name: "Finance Administrator", role: "Finance Administrator" };
const typeOptions = Object.keys(discountTypeLabels) as DiscountType[];

export default function DiscountsPage() {
  const discounts = useDiscounts();
  const students = useStudents();
  const structures = useFeeStructures();
  const db = useSisStore();
  const { can } = usePermissions();
  const canManage = can("fees.manageDiscounts");

  const [createOpen, setCreateOpen] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<DiscountType>("custom");
  const [percent, setPercent] = useState(10);
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

  const columns: ColumnDef<Discount>[] = [
    {
      id: "name",
      header: "Discount",
      alwaysVisible: true,
      sortValue: (d) => d.name,
      cell: (d) => (
        <div>
          <p className="text-sm font-medium text-foreground">{d.name}</p>
          <p className="text-xs text-muted-foreground">{studentName(d.studentId)}</p>
        </div>
      ),
    },
    { id: "type", header: "Type", cell: (d) => <Badge tone="info">{discountTypeLabels[d.type]}</Badge> },
    { id: "value", header: "Value", cell: (d) => <span className="text-sm text-foreground">{d.percent ? `${d.percent}%` : d.amount ? formatMoney(d.amount) : "—"}</span> },
    { id: "effective", header: "Effective from", cell: (d) => <span className="text-sm text-muted-foreground">{formatDate(d.effectiveFrom)}</span>, defaultVisible: false },
    {
      id: "status",
      header: "Status",
      align: "right",
      cell: (d) => <Badge tone={d.status === "active" ? "success" : d.status === "rejected" || d.status === "revoked" ? "error" : "neutral"}>{approvalWorkflowStatusLabels[d.status]}</Badge>,
    },
  ];

  const rowActions: RowAction<Discount>[] = canManage
    ? [
        { key: "approve", label: "Approve", icon: <Check className="size-3.5" />, hidden: (d) => d.status !== "submitted" && d.status !== "under-review", onSelect: (d) => approveWaiver("discount", d.id, ACTOR) },
        { key: "reject", label: "Reject", icon: <X className="size-3.5" />, hidden: (d) => d.status !== "submitted" && d.status !== "under-review", onSelect: (d) => rejectWaiver("discount", d.id, "Not approved", ACTOR) },
        { key: "revoke", label: "Revoke", icon: <XCircle className="size-3.5" />, hidden: (d) => d.status !== "active", destructive: true, onSelect: (d) => revokeWaiver("discount", d.id, "Revoked by finance", ACTOR) },
      ]
    : [];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Discounts</h1>
          <p className="text-xs text-muted-foreground">Sibling, merit, promotional and other fee discounts</p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" />
            Request discount
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={discounts}
        getRowId={(d) => d.id}
        caption="Discounts"
        rowActions={rowActions}
        renderMobileCard={(d) => (
          <div className="surface-3d flex flex-col gap-1 rounded-lg border border-border bg-surface p-sm">
            <div className="flex items-center justify-between gap-xs">
              <p className="truncate text-sm font-semibold text-foreground">{d.name}</p>
              <Badge tone={d.status === "active" ? "success" : "neutral"}>{approvalWorkflowStatusLabels[d.status]}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {studentName(d.studentId)} · {d.percent ? `${d.percent}%` : d.amount ? formatMoney(d.amount) : "—"}
            </p>
          </div>
        )}
        emptyIcon={Coins}
        emptyTitle="No discounts recorded"
      />

      <DetailDrawer
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setError(null);
        }}
        title="Request a discount"
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
            <Label htmlFor="disc-name">Name</Label>
            <Input id="disc-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sibling discount" />
          </div>
          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as DiscountType)}>
              <SelectTrigger aria-label="Discount type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {typeOptions.map((t) => (
                  <SelectItem key={t} value={t}>
                    {discountTypeLabels[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="disc-percent">Percent off</Label>
            <Input id="disc-percent" type="number" min={0} max={100} value={percent} onChange={(e) => setPercent(Number(e.target.value))} />
          </div>
          <Button
            disabled={!studentId || !name.trim()}
            onClick={() => {
              const result = requestDiscount({ studentId, name: name.trim(), type, percent, applicableComponentIds: applicableComponentIdsFor(studentId), session: CURRENT_SESSION, effectiveFrom: new Date().toISOString() }, ACTOR);
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
