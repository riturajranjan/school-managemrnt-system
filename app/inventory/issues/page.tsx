"use client";

import { useState } from "react";
import { ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { issueStock } from "@/lib/services/inventory-service";
import { roleLabels } from "@/lib/permissions/roles";
import { issueRecipientTypeLabels, issueStatusLabels, type IssueRecipientType, type IssueStatus } from "@/lib/types/inventory";
import { formatDate } from "@/lib/utils";

const statusTone: Record<IssueStatus, "success" | "warning" | "info" | "neutral"> = {
  issued: "info",
  "partially-returned": "warning",
  returned: "success",
  consumed: "neutral",
  overdue: "warning",
};

export default function InventoryIssuesPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const actor = { name: "Storekeeper", role: roleLabels[role] };
  const [itemId, setItemId] = useState(db.inventoryItems[0]?.id ?? "");
  const [qty, setQty] = useState("1");
  const [recipient, setRecipient] = useState("");
  const [recipientType, setRecipientType] = useState<IssueRecipientType>("classroom");
  const [error, setError] = useState<string | null>(null);
  const [, force] = useState(0);

  if (!can("inventory.view")) return <PermissionDenied action="view issues" role={roleLabels[role]} backHref="/inventory" />;
  const canIssue = can("inventory.issue");
  const itemName = (id: string) => db.inventoryItems.find((i) => i.id === id)?.name ?? id;

  function submit() {
    setError(null);
    if (!recipient.trim()) return setError("Recipient is required.");
    const r = issueStock({ itemId, quantity: Number(qty) || 0, recipientType, recipientName: recipient.trim(), returnable: recipientType === "department" || recipientType === "laboratory", purpose: "Issued from desk" }, actor);
    if (!r.ok) return setError(r.error);
    setRecipient("");
    setQty("1");
    force((n) => n + 1);
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Inventory issues</h1>
        <p className="text-xs text-muted-foreground">Issue stock to classes, departments and events</p>
      </div>

      {canIssue && (
        <div className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
          <div className="grid grid-cols-1 gap-sm sm:grid-cols-4">
            <Select value={itemId} onValueChange={setItemId}>
              <SelectTrigger aria-label="Item"><SelectValue placeholder="Item" /></SelectTrigger>
              <SelectContent>{db.inventoryItems.map((i) => <SelectItem key={i.id} value={i.id}>{i.name} ({i.quantity})</SelectItem>)}</SelectContent>
            </Select>
            <Input type="number" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Qty" aria-label="Quantity" />
            <Select value={recipientType} onValueChange={(v) => setRecipientType(v as IssueRecipientType)}>
              <SelectTrigger aria-label="Recipient type"><SelectValue /></SelectTrigger>
              <SelectContent>{(Object.keys(issueRecipientTypeLabels) as IssueRecipientType[]).map((t) => <SelectItem key={t} value={t}>{issueRecipientTypeLabels[t]}</SelectItem>)}</SelectContent>
            </Select>
            <Input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="Recipient name" aria-label="Recipient" />
          </div>
          {error && <p className="rounded-md border border-error/30 bg-error/8 p-sm text-sm text-error">{error}</p>}
          <div className="flex justify-end"><Button size="sm" onClick={submit}>Issue stock</Button></div>
        </div>
      )}

      <div className="flex flex-col gap-sm">
        {db.inventoryIssues.length === 0 ? (
          <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-xl text-center">
            <ClipboardList className="size-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No issues recorded yet.</p>
          </div>
        ) : (
          [...db.inventoryIssues].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((issue) => (
            <div key={issue.id} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{itemName(issue.itemId)} × {issue.quantity}</p>
                <p className="text-xs text-muted-foreground">{issueRecipientTypeLabels[issue.recipientType]} · {issue.recipientName} · {formatDate(issue.issueDate)}</p>
              </div>
              <Badge tone={statusTone[issue.status]}>{issueStatusLabels[issue.status]}</Badge>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
