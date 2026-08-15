"use client";

// Promotion hub (Phase 8E) — real PostgreSQL/API cutover. Promotion is an
// explicit administrative decision, never an automatic consequence of an exam
// result (see lib/server/promotion/service.ts) — so there is no fictional
// "readiness rule" panel here anymore (the old mock's attendance/percent
// thresholds had zero real backing). This page picks a real published exam,
// a real source class/section, and a real target academic session, shows a
// live real candidate-count preview, then hands off to the review screen.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, ArrowRight, GraduationCap, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useClasses, useSections } from "@/lib/hooks/api/use-academics-foundation";
import { useReportCardExams } from "@/lib/hooks/api/use-report-cards-api";
import { useAcademicSessions, usePromotionCandidates } from "@/lib/hooks/api/use-promotions-api";

export default function PromotionHubPage() {
  const router = useRouter();
  const { can } = usePermissions();
  const canManage = can("promotion.manage");

  const { data: exams, loading: examsLoading } = useReportCardExams();
  const { data: sessions, loading: sessionsLoading } = useAcademicSessions();
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [examId, setExamId] = useState("");
  const [targetSessionId, setTargetSessionId] = useState("");

  const { data: classes } = useClasses();
  const { data: sections } = useSections(classId || undefined);
  const targetSessions = sessions.filter((s) => !s.isCurrent);

  const { data: candidates, loading: candidatesLoading } = usePromotionCandidates(examId || undefined, targetSessionId || undefined, classId || undefined, sectionId || undefined);

  if (!can("promotion.view")) {
    return <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">You don&apos;t have permission to view promotion.</p>;
  }

  const ready = candidates?.filter((c) => c.eligibility.state === "ready").length ?? 0;
  const blocked = candidates?.filter((c) => c.eligibility.state !== "ready" && c.eligibility.state !== "already_processed").length ?? 0;
  const processed = candidates?.filter((c) => c.eligibility.state === "already_processed").length ?? 0;
  const canReview = Boolean(examId && targetSessionId);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Promotion</h1>
          <p className="text-xs text-muted-foreground">Review a published exam&apos;s results, then decide — promote or retain — into the next academic session</p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href="/promotion/history">
            <History className="size-3.5" />
            History
          </Link>
        </Button>
      </div>

      <div className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
        <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
          <div>
            <label className="mb-xs block text-xs font-medium text-foreground">Published exam</label>
            <Select value={examId} onValueChange={setExamId}>
              <SelectTrigger aria-label="Exam">
                <SelectValue placeholder={examsLoading ? "Loading…" : "Select a published exam"} />
              </SelectTrigger>
              <SelectContent>
                {exams.map((e) => (
                  <SelectItem key={e.examId} value={e.examId}>
                    {e.examName} ({e.termName})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!examsLoading && exams.length === 0 && <p className="mt-1 text-xs text-muted-foreground">No exam has published results yet.</p>}
          </div>
          <div>
            <label className="mb-xs block text-xs font-medium text-foreground">Target academic session</label>
            <Select value={targetSessionId} onValueChange={setTargetSessionId}>
              <SelectTrigger aria-label="Target academic session">
                <SelectValue placeholder={sessionsLoading ? "Loading…" : "Select target session"} />
              </SelectTrigger>
              <SelectContent>
                {targetSessions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!sessionsLoading && targetSessions.length === 0 && <p className="mt-1 text-xs text-muted-foreground">No other academic session exists yet — create one in Settings first.</p>}
          </div>
          <div>
            <label className="mb-xs block text-xs font-medium text-foreground">Class (optional filter)</label>
            <Select value={classId} onValueChange={(v) => { setClassId(v); setSectionId(""); }}>
              <SelectTrigger aria-label="Class">
                <SelectValue placeholder="All classes" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-xs block text-xs font-medium text-foreground">Section (optional filter)</label>
            <Select value={sectionId} onValueChange={setSectionId} disabled={!classId}>
              <SelectTrigger aria-label="Section">
                <SelectValue placeholder="All sections" />
              </SelectTrigger>
              <SelectContent>
                {sections.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {canReview && (
          <div className="grid grid-cols-3 gap-sm border-t border-border pt-sm text-center text-sm">
            <div>
              <p className="text-lg font-bold text-foreground">{candidatesLoading ? "…" : ready}</p>
              <p className="text-xs text-muted-foreground">Ready for a decision</p>
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">{candidatesLoading ? "…" : processed}</p>
              <p className="text-xs text-muted-foreground">Already decided</p>
            </div>
            <div>
              <p className={`text-lg font-bold ${blocked > 0 ? "text-warning" : "text-foreground"}`}>{candidatesLoading ? "…" : blocked}</p>
              <p className="text-xs text-muted-foreground">Blocked</p>
            </div>
          </div>
        )}

        {canReview && !candidatesLoading && candidates?.length === 0 && (
          <div className="flex items-center gap-sm rounded-md border border-warning/30 bg-warning/8 px-sm py-sm text-sm text-warning">
            <AlertTriangle className="size-4 shrink-0" />
            No currently-enrolled students match this class/section in the current session.
          </div>
        )}

        <Button
          className="mt-1 w-full"
          disabled={!canReview || !canManage}
          onClick={() => router.push(`/promotion/run?examId=${examId}&targetAcademicSessionId=${targetSessionId}${classId ? `&classId=${classId}` : ""}${sectionId ? `&sectionId=${sectionId}` : ""}`)}
        >
          <GraduationCap className="size-3.5" />
          Review candidates
          <ArrowRight className="size-3.5" />
        </Button>
        {!canManage && <p className="text-center text-xs text-muted-foreground">You can view candidates but don&apos;t have permission to process decisions.</p>}
      </div>
    </div>
  );
}
