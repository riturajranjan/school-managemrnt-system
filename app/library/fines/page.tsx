"use client";

import { useState } from "react";
import { Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { addFineToAccount, collectFine, fineOutstanding, waiveFine } from "@/lib/services/library-fine-service";
import { roleLabels } from "@/lib/permissions/roles";
import { fineStatusLabels, fineTypeLabels, type FineStatus, type LibraryFine } from "@/lib/types/library";
import { formatMoney } from "@/lib/finance/money";

const statusTone: Record<FineStatus, "success" | "warning" | "error" | "neutral" | "info"> = {
  generated: "warning",
  pending: "warning",
  paid: "success",
  "partially-paid": "info",
  waived: "neutral",
  cancelled: "neutral",
  refunded: "neutral",
};

export default function FinesPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const actor = { name: "Librarian", role: roleLabels[role] };
  const [, force] = useState(0);
  const [waiveTarget, setWaiveTarget] = useState<LibraryFine | null>(null);
  const [waiveReason, setWaiveReason] = useState("");

  if (!can("library.manageFines")) return <PermissionDenied action="manage library fines" role={roleLabels[role]} />;
  const canWaive = can("library.waiveFines");

  const outstanding = db.libraryFines.filter((f) => f.status === "pending" || f.status === "partially-paid" || f.status === "generated");
  const settled = db.libraryFines.filter((f) => !outstanding.includes(f));
  const memberName = (id: string) => db.libraryMembers.find((m) => m.id === id)?.name ?? id;

  function submitWaive() {
    if (!waiveTarget) return;
    const result = waiveFine(waiveTarget.id, actor, { reason: waiveReason || "Waived by librarian" });
    if (!result.ok) alert(result.error);
    setWaiveTarget(null);
    setWaiveReason("");
    force((n) => n + 1);
  }

  function renderFine(fine: LibraryFine) {
    const due = fineOutstanding(fine);
    return (
      <div key={fine.id} className="flex flex-col gap-xs rounded-lg border border-border bg-surface p-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{memberName(fine.memberId)}</p>
          <p className="text-xs text-muted-foreground">{fineTypeLabels[fine.type]} · {fine.reason ?? "—"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-xs">
          <span className="text-sm font-semibold text-foreground">{formatMoney(fine.amount)}</span>
          {due.minorUnits > 0 && <span className="text-xs text-warning">{formatMoney(due)} due</span>}
          <Badge tone={statusTone[fine.status]}>{fineStatusLabels[fine.status]}</Badge>
          {due.minorUnits > 0 && (
            <>
              <Button size="sm" variant="outline" onClick={() => { collectFine(fine.id, due, actor); force((n) => n + 1); }}>Collect</Button>
              <Button size="sm" variant="ghost" onClick={() => { const r = addFineToAccount(fine.id, actor); if (!r.ok) alert(r.error); force((n) => n + 1); }}>Add to account</Button>
              {canWaive && <Button size="sm" variant="ghost" onClick={() => setWaiveTarget(fine)}>Waive</Button>}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Fines</h1>
        <p className="text-xs text-muted-foreground">Overdue, lost and damage charges · integrated with the fee ledger</p>
      </div>

      <section>
        <h2 className="mb-sm text-sm font-semibold text-foreground">Outstanding ({outstanding.length})</h2>
        {outstanding.length === 0 ? (
          <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-xl text-center">
            <Wallet className="size-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No outstanding fines. Nicely done.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-sm">{outstanding.map(renderFine)}</div>
        )}
      </section>

      {settled.length > 0 && (
        <section>
          <h2 className="mb-sm text-sm font-semibold text-foreground">Settled ({settled.length})</h2>
          <div className="flex flex-col gap-sm">{settled.slice(0, 20).map(renderFine)}</div>
        </section>
      )}

      <ConfirmDialog
        open={waiveTarget !== null}
        onOpenChange={(open) => { if (!open) setWaiveTarget(null); }}
        title="Waive fine"
        description="Waiving is recorded in the audit trail with your name and reason."
        confirmLabel="Waive fine"
        onConfirm={submitWaive}
      />
      {waiveTarget && (
        <div className="fixed bottom-24 left-1/2 z-[60] w-[min(92vw,360px)] -translate-x-1/2 rounded-lg border border-border bg-surface p-sm shadow-floating sm:bottom-8">
          <p className="mb-1 text-xs font-medium text-foreground">Reason for waiver ({formatMoney(fineOutstanding(waiveTarget))})</p>
          <Input value={waiveReason} onChange={(e) => setWaiveReason(e.target.value)} placeholder="e.g. First offence, goodwill" aria-label="Waiver reason" />
        </div>
      )}
    </div>
  );
}
