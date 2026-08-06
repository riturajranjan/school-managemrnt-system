"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useManagedClasses } from "@/lib/hooks/use-academics";
import { usePromotionRun } from "@/lib/hooks/use-exams";
import { useSisStore } from "@/lib/hooks/use-store";
import { confirmPromotionRun, updateDecision } from "@/lib/services/promotion-service";
import { promotionDecisionLabels, type PromotionDecisionType } from "@/lib/types/promotion";

const ACTOR = { name: "Principal", role: "Principal" };
const decisionOptions: PromotionDecisionType[] = ["promote", "conditional-promotion", "retain", "transfer", "graduate", "withdraw", "pending"];

function PromotionRunContent() {
  const searchParams = useSearchParams();
  const runId = searchParams.get("runId") ?? "";
  const db = useSisStore();
  const run = usePromotionRun(runId);
  const classes = useManagedClasses();
  const { can } = usePermissions();
  const canApprove = can("promotion.approve");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [outcome, setOutcome] = useState<{ ok: boolean; message: string } | null>(null);

  if (!run) return <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Promotion run not found.</p>;

  const originClass = classes.find((c) => c.id === run.classId);
  const defaultTargetClass = classes.find((c) => c.order === (originClass?.order ?? 0) + 1);
  const needsDestination = run.decisions.filter((d) => (d.decision === "promote" || d.decision === "conditional-promotion") && (!d.toClassId || !d.toSectionId)).length;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-sm">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Promotion run — {originClass?.name}</h1>
          <p className="text-xs text-muted-foreground">
            {run.fromSession} → {run.toSession} · {run.decisions.length} student{run.decisions.length === 1 ? "" : "s"}
          </p>
        </div>
        <Badge tone={run.status === "completed" ? "success" : "neutral"}>{run.status}</Badge>
      </div>

      {run.status !== "completed" && needsDestination > 0 && (
        <div className="flex items-center gap-sm rounded-lg border border-warning/30 bg-warning/8 px-sm py-sm text-sm text-warning">
          <AlertTriangle className="size-4 shrink-0" />
          {needsDestination} student(s) still need a destination class and section before this run can be confirmed.
        </div>
      )}

      {outcome && (
        <div className={`flex items-center gap-sm rounded-lg border px-sm py-sm text-sm ${outcome.ok ? "border-success/30 bg-success/8 text-success" : "border-error/30 bg-error/8 text-error"}`}>
          {outcome.ok ? <CheckCircle2 className="size-4 shrink-0" /> : <AlertTriangle className="size-4 shrink-0" />}
          {outcome.message}
        </div>
      )}

      <div className="flex flex-col gap-sm">
        {run.decisions.map((decision) => {
          const student = db.students.find((s) => s.id === decision.studentId);
          const showDestination = decision.decision === "promote" || decision.decision === "conditional-promotion";
          const targetClass = classes.find((c) => c.id === (decision.toClassId ?? defaultTargetClass?.id));
          return (
            <div key={decision.studentId} className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{student ? `${student.profile.firstName} ${student.profile.lastName}` : decision.studentId}</p>
                <p className="text-xs text-muted-foreground">{decision.reason}</p>
              </div>
              <div className="flex flex-wrap items-center gap-xs">
                <Select
                  value={decision.decision}
                  onValueChange={(v) => updateDecision(run.id, decision.studentId, { decision: v as PromotionDecisionType, toClassId: v === "promote" || v === "conditional-promotion" ? (decision.toClassId ?? defaultTargetClass?.id) : undefined })}
                  disabled={run.status === "completed" || !canApprove}
                >
                  <SelectTrigger className="w-44" aria-label="Decision">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {decisionOptions.map((d) => (
                      <SelectItem key={d} value={d}>
                        {promotionDecisionLabels[d]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {showDestination && (
                  <>
                    <Select value={decision.toClassId ?? ""} onValueChange={(v) => updateDecision(run.id, decision.studentId, { toClassId: v, toSectionId: undefined })} disabled={run.status === "completed" || !canApprove}>
                      <SelectTrigger className="w-32" aria-label="Destination class">
                        <SelectValue placeholder="Class" />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={decision.toSectionId ?? ""} onValueChange={(v) => updateDecision(run.id, decision.studentId, { toSectionId: v })} disabled={run.status === "completed" || !canApprove || !targetClass}>
                      <SelectTrigger className="w-28" aria-label="Destination section">
                        <SelectValue placeholder="Section" />
                      </SelectTrigger>
                      <SelectContent>
                        {targetClass?.sections.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name} ({s.enrolledCount}/{s.capacity})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      defaultValue={decision.newRollNumber ?? ""}
                      onBlur={(e) => updateDecision(run.id, decision.studentId, { newRollNumber: e.target.value || undefined })}
                      placeholder="Roll no."
                      className="w-20"
                      disabled={run.status === "completed" || !canApprove}
                    />
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {run.status !== "completed" && canApprove && (
        <Button onClick={() => setConfirmOpen(true)} disabled={needsDestination > 0}>
          Confirm promotion for {run.decisions.filter((d) => d.decision !== "pending").length} student(s)
        </Button>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Confirm this promotion run?"
        description="Student class, section and session assignments will be updated immediately. This is recorded in the audit log and reflected across the whole system."
        confirmLabel="Confirm promotion"
        onConfirm={() => {
          const result = confirmPromotionRun(run.id, ACTOR);
          setOutcome(result.ok ? { ok: true, message: `${result.promoted} student(s) promoted successfully.` } : { ok: false, message: result.errors.join(" ") });
          setConfirmOpen(false);
        }}
      />
    </div>
  );
}

export default function PromotionRunPage() {
  return (
    <Suspense fallback={<div className="h-40" />}>
      <PromotionRunContent />
    </Suspense>
  );
}
