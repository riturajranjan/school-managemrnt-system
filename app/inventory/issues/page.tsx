"use client";

// Inventory issues (Phase 9O) — real PostgreSQL/API cutover. A Staff/Student
// recipient is always a real Staff.id/Student.id (picked from the real
// directories) — "Other" (department/classroom/event/purpose) is a genuine
// descriptive label, never a stand-in identity.
import { useState } from "react";
import { ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useStudentList } from "@/lib/hooks/api/use-students";
import { useStaffList } from "@/lib/hooks/api/use-staff-api";
import { issueStockRequest, useInventoryIssues, useInventoryItems } from "@/lib/hooks/api/use-inventory-api";
import { roleLabels } from "@/lib/permissions/roles";
import type { InventoryIssueStatusDto, InventoryRecipientKindDto } from "@/lib/api/contracts";
import { formatDate } from "@/lib/utils";

const statusTone: Record<InventoryIssueStatusDto, "success" | "warning" | "info"> = {
  issued: "info",
  "partially-returned": "warning",
  returned: "success",
};
const statusLabels: Record<InventoryIssueStatusDto, string> = {
  issued: "Issued", "partially-returned": "Partially returned", returned: "Returned",
};

export default function InventoryIssuesPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: items } = useInventoryItems();
  const { data: issues, reload } = useInventoryIssues();
  const { data: students } = useStudentList({ status: ["active"], pageSize: 150 });
  const { data: staff } = useStaffList({ status: "active", pageSize: 200 });

  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState("1");
  const [recipientKind, setRecipientKind] = useState<InventoryRecipientKindDto>("other");
  const [recipientId, setRecipientId] = useState("");
  const [recipientLabel, setRecipientLabel] = useState("");
  const [returnable, setReturnable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!capabilitiesLoading && !hasServerPermission("inventory.view")) return <PermissionDenied action="view issues" role={roleLabels[role]} backHref="/inventory" />;
  const canIssue = hasServerPermission("inventory.manage");
  const effectiveItemId = itemId || items[0]?.id || "";

  async function submit() {
    setError(null);
    if (recipientKind === "other" && !recipientLabel.trim()) return setError("A recipient label is required.");
    if (recipientKind !== "other" && !recipientId) return setError("Select a recipient.");
    setBusy(true);
    const res = await issueStockRequest({
      itemId: effectiveItemId, quantity: Number(qty) || 0, recipientKind,
      recipientStaffId: recipientKind === "staff" ? recipientId : undefined,
      recipientStudentId: recipientKind === "student" ? recipientId : undefined,
      recipientLabel: recipientKind === "other" ? recipientLabel.trim() : undefined,
      returnable, purpose: "Issued from desk",
    });
    setBusy(false);
    if (!res.success) return setError(res.error.message);
    setRecipientId(""); setRecipientLabel(""); setQty("1");
    reload();
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Inventory issues</h1>
        <p className="text-xs text-muted-foreground">Issue stock to staff, students or a department/classroom/event</p>
      </div>

      {canIssue && (
        <div className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
          <div className="grid grid-cols-1 gap-sm sm:grid-cols-4">
            <Select value={effectiveItemId} onValueChange={setItemId}>
              <SelectTrigger aria-label="Item"><SelectValue placeholder="Item" /></SelectTrigger>
              <SelectContent>{items.map((i) => <SelectItem key={i.id} value={i.id}>{i.name} ({i.quantity})</SelectItem>)}</SelectContent>
            </Select>
            <Input type="number" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Qty" aria-label="Quantity" />
            <Select value={recipientKind} onValueChange={(v) => { setRecipientKind(v as InventoryRecipientKindDto); setRecipientId(""); setRecipientLabel(""); }}>
              <SelectTrigger aria-label="Recipient type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="staff">Staff</SelectItem>
                <SelectItem value="student">Student</SelectItem>
                <SelectItem value="other">Department / classroom / event</SelectItem>
              </SelectContent>
            </Select>
            {recipientKind === "other" ? (
              <Input value={recipientLabel} onChange={(e) => setRecipientLabel(e.target.value)} placeholder="e.g. Science Lab" aria-label="Recipient label" />
            ) : (
              <Select value={recipientId} onValueChange={setRecipientId}>
                <SelectTrigger aria-label="Recipient"><SelectValue placeholder="Select recipient" /></SelectTrigger>
                <SelectContent>
                  {recipientKind === "staff"
                    ? staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)
                    : students.map((s) => <SelectItem key={s.id} value={s.id}>{s.fullName}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input type="checkbox" checked={returnable} onChange={(e) => setReturnable(e.target.checked)} /> Returnable (durable item — expected back)
          </label>
          {error && <p className="rounded-md border border-error/30 bg-error/8 p-sm text-sm text-error">{error}</p>}
          <div className="flex justify-end"><Button size="sm" onClick={submit} disabled={busy}>Issue stock</Button></div>
        </div>
      )}

      <div className="flex flex-col gap-sm">
        {issues.length === 0 ? (
          <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-xl text-center">
            <ClipboardList className="size-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No issues recorded yet.</p>
          </div>
        ) : (
          issues.map((issue) => (
            <div key={issue.id} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{issue.itemName} × {issue.quantity}</p>
                <p className="text-xs text-muted-foreground">{issue.recipientName} · {formatDate(issue.createdAt)}</p>
              </div>
              <Badge tone={statusTone[issue.status]}>{statusLabels[issue.status]}</Badge>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
