"use client";

// Promotion review (Phase 8E) — real PostgreSQL/API cutover. Reviews REAL
// candidates for one (published exam -> target academic session) transition
// and lets the admin make an EXPLICIT decision per student — a PASS result
// never auto-selects "Promote" here, it's just shown as the exam result.
// Each student's decision is its own atomic server transaction
// (POST /api/promotions/process); this page fires one request per selected
// student and reports success/failure per row, rather than one giant
// all-or-nothing batch — a capacity conflict on one student must not undo
// everyone else's already-successful promotion.
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/input";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useClasses, useSections } from "@/lib/hooks/api/use-academics-foundation";
import { processPromotionRequest, usePromotionCandidates } from "@/lib/hooks/api/use-promotions-api";
import type { PromotionCandidateDto, PromotionDecisionDto } from "@/lib/api/contracts";

const eligibilityLabel: Record<string, string> = {
  ready: "Ready", blocked_result_unpublished: "Results not published", blocked_result_incomplete: "No result for this exam",
  already_processed: "Already decided", no_current_enrollment: "Not currently enrolled", target_not_configured: "Choose a target",
};
const eligibilityTone: Record<string, "success" | "warning" | "neutral" | "error"> = {
  ready: "success", blocked_result_unpublished: "warning", blocked_result_incomplete: "warning", already_processed: "neutral", no_current_enrollment: "error", target_not_configured: "neutral",
};
const resultStatusTone: Record<string, "success" | "error" | "neutral"> = { pass: "success", fail: "error", absent: "neutral" };

type RowState = { decision: PromotionDecisionDto | "skip"; targetClassId: string; targetSectionId: string; notes: string; submitting: boolean; error: string | null; done: boolean };

function PromotionRunContent() {
  const searchParams = useSearchParams();
  const examId = searchParams.get("examId") ?? "";
  const targetAcademicSessionId = searchParams.get("targetAcademicSessionId") ?? "";
  const classId = searchParams.get("classId") ?? undefined;
  const sectionId = searchParams.get("sectionId") ?? undefined;

  const { can } = usePermissions();
  const canManage = can("promotion.manage");

  const { data: candidates, loading, error, reload } = usePromotionCandidates(examId || undefined, targetAcademicSessionId || undefined, classId, sectionId);
  const { data: targetClasses } = useClasses(targetAcademicSessionId || undefined);
  const [defaultClassId, setDefaultClassId] = useState("");

  const [rows, setRows] = useState<Record<string, RowState>>({});
  // Adjusting state to match newly-arrived candidates during render (not in an
  // effect) — the React-recommended pattern for "state derived from props/data
  // that must still be locally editable and preserved across reloads." Keyed
  // on the candidate id set so it only resets when that set actually changes,
  // never on every render.
  const candidateKey = candidates ? candidates.map((c) => c.student.id).join(",") : null;
  const [syncedKey, setSyncedKey] = useState<string | null>(null);
  if (candidates && candidateKey !== syncedKey) {
    setSyncedKey(candidateKey);
    setRows((prev) => {
      const next: Record<string, RowState> = {};
      for (const c of candidates) {
        next[c.student.id] = prev[c.student.id] ?? { decision: "skip", targetClassId: defaultClassId, targetSectionId: "", notes: "", submitting: false, error: null, done: c.eligibility.state === "already_processed" };
      }
      return next;
    });
  }

  function patchRow(studentId: string, patch: Partial<RowState>) {
    setRows((prev) => ({ ...prev, [studentId]: { ...prev[studentId], ...patch } }));
  }

  function applyDefaultTarget() {
    setRows((prev) => {
      const next = { ...prev };
      for (const id of Object.keys(next)) {
        if (next[id].decision !== "skip" && !next[id].done) next[id] = { ...next[id], targetClassId: defaultClassId, targetSectionId: "" };
      }
      return next;
    });
  }

  if (!examId || !targetAcademicSessionId) {
    return <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Missing exam or target session — start from the Promotion hub.</p>;
  }
  if (!can("promotion.view")) {
    return <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">You don&apos;t have permission to view promotion.</p>;
  }
  if (loading && !candidates) return <p className="py-2xl text-center text-sm text-muted-foreground">Loading candidates…</p>;
  if (error || !candidates) {
    return (
      <div className="flex flex-col gap-sm">
        <Link href="/promotion" className="text-xs text-muted-foreground hover:underline">← Promotion</Link>
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  const selectedCount = Object.values(rows).filter((r) => r.decision !== "skip" && !r.done).length;

  async function processSelected() {
    if (!candidates) return;
    const toProcess = candidates.filter((c) => rows[c.student.id] && rows[c.student.id].decision !== "skip" && !rows[c.student.id].done);
    await Promise.allSettled(
      toProcess.map(async (c) => {
        const row = rows[c.student.id];
        if (!c.result || !row.targetClassId || !row.targetSectionId) return;
        patchRow(c.student.id, { submitting: true, error: null });
        const res = await processPromotionRequest({
          studentId: c.student.id, sourceStudentResultId: c.result.studentExamResultId, targetAcademicSessionId,
          decision: row.decision as PromotionDecisionDto, targetClassId: row.targetClassId, targetSectionId: row.targetSectionId,
          notes: row.notes.trim() || undefined,
        });
        if (res.success) patchRow(c.student.id, { submitting: false, done: true });
        else patchRow(c.student.id, { submitting: false, error: res.error.message });
      }),
    );
    reload();
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-sm">
        <div>
          <Link href="/promotion" className="text-xs text-muted-foreground hover:underline">← Promotion</Link>
          <h1 className="text-lg font-semibold text-foreground">Promotion review</h1>
          <p className="text-xs text-muted-foreground">{candidates.length} student{candidates.length === 1 ? "" : "s"}</p>
        </div>
      </div>

      {canManage && (
        <div className="flex flex-wrap items-end gap-sm rounded-lg border border-border bg-surface p-sm">
          <div>
            <label className="mb-xs block text-xs font-medium text-foreground">Default target class</label>
            <Select value={defaultClassId} onValueChange={(v) => { setDefaultClassId(v); }}>
              <SelectTrigger className="w-40" aria-label="Default target class">
                <SelectValue placeholder="Class" />
              </SelectTrigger>
              <SelectContent>
                {targetClasses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" variant="outline" onClick={applyDefaultTarget} disabled={!defaultClassId}>
            Apply to selected decisions
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-sm">
        {candidates.map((c) => (
          <CandidateRow
            key={c.student.id}
            candidate={c}
            row={rows[c.student.id]}
            canManage={canManage}
            targetClasses={targetClasses}
            targetAcademicSessionId={targetAcademicSessionId}
            onPatch={(patch) => patchRow(c.student.id, patch)}
          />
        ))}
        {candidates.length === 0 && <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No candidates for this class/section.</p>}
      </div>

      {canManage && selectedCount > 0 && (
        <Button onClick={processSelected} disabled={Object.values(rows).some((r) => r.submitting)}>
          {Object.values(rows).some((r) => r.submitting) ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
          Process {selectedCount} decision{selectedCount === 1 ? "" : "s"}
        </Button>
      )}
    </div>
  );
}

function CandidateRow({
  candidate, row, canManage, targetClasses, targetAcademicSessionId, onPatch,
}: {
  candidate: PromotionCandidateDto;
  row: RowState | undefined;
  canManage: boolean;
  targetClasses: { id: string; name: string }[];
  targetAcademicSessionId: string;
  onPatch: (patch: Partial<RowState>) => void;
}) {
  const { data: sections } = useSections(row?.targetClassId || undefined, targetAcademicSessionId);
  if (!row) return null;

  const alreadyDone = candidate.eligibility.state === "already_processed" || row.done;
  const canDecide = canManage && candidate.eligibility.state === "ready" && !alreadyDone;

  return (
    <div className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-sm">
      <div className="flex flex-wrap items-start justify-between gap-sm">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{candidate.student.name}</p>
          <p className="text-xs text-muted-foreground">
            Roll {candidate.student.rollNumber ?? "—"} · {candidate.currentEnrollment ? `${candidate.currentEnrollment.className}-${candidate.currentEnrollment.sectionName}` : "No current enrollment"}
          </p>
        </div>
        <Badge tone={eligibilityTone[candidate.eligibility.state] ?? "neutral"}>{eligibilityLabel[candidate.eligibility.state] ?? candidate.eligibility.state}</Badge>
      </div>

      <div className="grid grid-cols-3 gap-sm text-xs">
        <div>
          <p className="text-muted-foreground">Result</p>
          <p className="font-medium text-foreground">
            {candidate.result ? (
              <Badge tone={resultStatusTone[candidate.result.status] ?? "neutral"}>{candidate.result.status}{candidate.result.percentage !== null ? ` · ${candidate.result.percentage}%` : ""}</Badge>
            ) : "—"}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Grade</p>
          <p className="font-medium text-foreground">{candidate.result?.grade ?? "—"}</p>
        </div>
      </div>

      {candidate.eligibility.reasons.length > 0 && <p className="text-xs text-muted-foreground">{candidate.eligibility.reasons.join(" ")}</p>}

      {alreadyDone && candidate.existingPromotion && (
        <p className="flex items-center gap-1 text-xs text-success">
          <CheckCircle2 className="size-3.5" />
          {candidate.existingPromotion.decision === "promoted" ? "Promoted" : "Retained"} to {candidate.existingPromotion.targetClass.name}-{candidate.existingPromotion.targetSection.name}
        </p>
      )}

      {row.error && (
        <p className="flex items-center gap-1 text-xs text-error">
          <AlertTriangle className="size-3.5 shrink-0" /> {row.error}
        </p>
      )}

      {!alreadyDone && (
        <div className="flex flex-wrap items-center gap-xs">
          <Select value={row.decision} onValueChange={(v) => onPatch({ decision: v as RowState["decision"], targetSectionId: "" })} disabled={!canDecide || row.submitting}>
            <SelectTrigger className="w-32" aria-label="Decision">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="skip">Pending</SelectItem>
              <SelectItem value="promoted">Promote</SelectItem>
              <SelectItem value="retained">Retain</SelectItem>
            </SelectContent>
          </Select>
          {row.decision !== "skip" && (
            <>
              <Select value={row.targetClassId} onValueChange={(v) => onPatch({ targetClassId: v, targetSectionId: "" })} disabled={!canDecide || row.submitting}>
                <SelectTrigger className="w-32" aria-label="Target class">
                  <SelectValue placeholder="Class" />
                </SelectTrigger>
                <SelectContent>
                  {targetClasses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={row.targetSectionId} onValueChange={(v) => onPatch({ targetSectionId: v })} disabled={!canDecide || row.submitting || !row.targetClassId}>
                <SelectTrigger className="w-28" aria-label="Target section">
                  <SelectValue placeholder="Section" />
                </SelectTrigger>
                <SelectContent>
                  {sections.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name} ({s.enrolledCount}/{s.capacity})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
          {row.submitting && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
        </div>
      )}

      {!alreadyDone && row.decision !== "skip" && canDecide && (
        <Textarea value={row.notes} onChange={(e) => onPatch({ notes: e.target.value })} placeholder="Notes (optional)" rows={1} className="text-xs" />
      )}
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
