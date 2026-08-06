"use client";

import { useState } from "react";
import { AlertTriangle, Banknote, Check, Landmark, Sparkles, Undo2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useStudents } from "@/lib/hooks/use-students";
import { useSisStore } from "@/lib/hooks/use-store";
import { formatMoney } from "@/lib/finance/money";
import { computeMatchSuggestions, confirmMatch, ignoreTransaction, isDuplicateTransaction, markAsFee, reconciliationStatusFor, undoReconciliation } from "@/lib/services/reconciliation-service";
import { paymentMethodLabels, reconciliationSourceLabels, reconciliationStatusLabels } from "@/lib/types/payments";
import { formatDate } from "@/lib/utils";

const ACTOR = { name: "Accountant", role: "Accountant" };

export default function ReconciliationPage() {
  const db = useSisStore();
  const students = useStudents();
  const { can } = usePermissions();
  const canReconcile = can("fees.reconcile");

  const [ignoreTarget, setIgnoreTarget] = useState<string | null>(null);
  const [ignoreReason, setIgnoreReason] = useState("");

  const suggestions = computeMatchSuggestions(db);
  const bestSuggestionFor = (txnId: string) => suggestions.find((s) => s.bankTransactionId === txnId);

  function studentName(id: string) {
    const s = students.find((st) => st.id === id);
    return s ? `${s.profile.firstName} ${s.profile.lastName}` : id;
  }

  const rows = db.bankTransactions.map((txn) => ({ txn, status: reconciliationStatusFor(db, txn.id), duplicate: isDuplicateTransaction(db, txn.id) }));
  const outstanding = rows.filter((r) => r.status === "unmatched" || r.status === "under-review");
  const resolved = rows.filter((r) => r.status !== "unmatched" && r.status !== "under-review");

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Reconciliation</h1>
        <p className="text-xs text-muted-foreground">Match bank &amp; gateway transactions against recorded payments — AI only suggests, a human always confirms</p>
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-surface p-sm">
          <p className="text-xs text-muted-foreground">Outstanding</p>
          <p className="text-sm font-semibold text-foreground">{outstanding.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-sm">
          <p className="text-xs text-muted-foreground">Reconciled</p>
          <p className="text-sm font-semibold text-success">{resolved.filter((r) => r.status === "reconciled").length}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-sm">
          <p className="text-xs text-muted-foreground">Ignored</p>
          <p className="text-sm font-semibold text-muted-foreground">{resolved.filter((r) => r.status === "ignored").length}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-sm">
          <p className="text-xs text-muted-foreground">Possible duplicates</p>
          <p className="text-sm font-semibold text-warning">{rows.filter((r) => r.duplicate).length}</p>
        </div>
      </div>

      <div className="flex flex-col gap-sm">
        <h2 className="text-sm font-semibold text-foreground">Needs attention ({outstanding.length})</h2>
        {outstanding.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Everything is reconciled.</p>
        ) : (
          outstanding.map(({ txn, duplicate }) => {
            const suggestion = bestSuggestionFor(txn.id);
            const payment = suggestion ? db.payments.find((p) => p.id === suggestion.paymentId) : undefined;
            return (
              <div key={txn.id} className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-sm">
                <div className="flex flex-wrap items-start justify-between gap-sm">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{txn.description ?? txn.reference}</p>
                    <p className="text-xs text-muted-foreground">
                      {reconciliationSourceLabels[txn.source]} · {formatDate(txn.date)} · Ref {txn.reference}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-xs">
                    {duplicate && (
                      <Badge tone="warning">
                        <AlertTriangle className="size-3" /> Possible duplicate
                      </Badge>
                    )}
                    <span className="text-sm font-semibold text-foreground">{formatMoney(txn.amount)}</span>
                  </div>
                </div>

                {suggestion && payment && (
                  <div className="flex flex-wrap items-center justify-between gap-sm rounded-md border border-info/30 bg-info/8 p-sm text-xs">
                    <span className="flex items-center gap-1.5 text-foreground">
                      <Sparkles className="size-3.5 text-info" />
                      Suggested match: {studentName(payment.studentId)} · {paymentMethodLabels[payment.method]} · {formatDate(payment.paidAt)} ({suggestion.confidence}% confidence)
                    </span>
                    {canReconcile && (
                      <Button size="sm" onClick={() => confirmMatch(txn.id, payment.id, ACTOR)}>
                        <Check className="size-3.5" />
                        Confirm match
                      </Button>
                    )}
                  </div>
                )}

                {canReconcile && (
                  <div className="flex flex-wrap items-center gap-xs border-t border-border pt-sm">
                    <Button size="sm" variant="outline" onClick={() => markAsFee(txn.id, "bank-charge", ACTOR)}>
                      <Landmark className="size-3.5" />
                      Mark as bank charge
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => markAsFee(txn.id, "settlement-fee", ACTOR)}>
                      <Banknote className="size-3.5" />
                      Mark as settlement fee
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-error"
                      onClick={() => {
                        setIgnoreTarget(txn.id);
                        setIgnoreReason("");
                      }}
                    >
                      <X className="size-3.5" />
                      Ignore
                    </Button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {resolved.length > 0 && (
        <div className="flex flex-col gap-sm">
          <h2 className="text-sm font-semibold text-foreground">Resolved ({resolved.length})</h2>
          <div className="flex flex-col gap-1">
            {resolved.map(({ txn, status }) => (
              <div key={txn.id} className="flex items-center justify-between gap-sm rounded-md border border-border px-sm py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate text-foreground">{txn.description ?? txn.reference}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(txn.date)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-xs">
                  <span className="text-xs text-muted-foreground">{formatMoney(txn.amount)}</span>
                  <Badge tone={status === "reconciled" ? "success" : "neutral"}>{reconciliationStatusLabels[status]}</Badge>
                  {canReconcile && (
                    <Button size="sm" variant="ghost" onClick={() => undoReconciliation(txn.id, ACTOR)} aria-label="Undo reconciliation">
                      <Undo2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <DetailDrawer open={ignoreTarget !== null} onOpenChange={(open) => !open && setIgnoreTarget(null)} title="Ignore transaction" description="Requires a reason for the audit trail">
        <div className="flex flex-col gap-sm">
          <div>
            <Label htmlFor="ignore-reason">Reason</Label>
            <Input id="ignore-reason" value={ignoreReason} onChange={(e) => setIgnoreReason(e.target.value)} placeholder="e.g. Not a school transaction" />
          </div>
          <Button
            disabled={!ignoreReason.trim()}
            onClick={() => {
              if (ignoreTarget) ignoreTransaction(ignoreTarget, ignoreReason.trim(), ACTOR);
              setIgnoreTarget(null);
            }}
          >
            Ignore transaction
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
