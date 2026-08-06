"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, GraduationCap, History, SlidersHorizontal, UserX } from "lucide-react";
import Link from "next/link";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useManagedClasses } from "@/lib/hooks/use-academics";
import { useSisStore } from "@/lib/hooks/use-store";
import { CURRENT_SESSION } from "@/lib/data/seed/reference";
import { computePromotionEligibility, createPromotionRun, type PromotionEligibility } from "@/lib/services/promotion-service";
import { computePromotionReadiness, type PromotionReadiness } from "@/lib/selectors/promotion-readiness";
import { promotionDecisionLabels } from "@/lib/types/promotion";

const ACTOR = { name: "Academic Coordinator", role: "Academic Coordinator" };

const decisionTone: Record<string, "success" | "warning" | "error" | "neutral"> = {
  promote: "success",
  "conditional-promotion": "warning",
  retain: "error",
  pending: "neutral",
};

function nextSessionLabel(session: string): string {
  const match = session.match(/(\d{4})-(\d{4})/);
  if (!match) return session;
  return `${Number(match[1]) + 1}-${Number(match[2]) + 1}`;
}

function ReadinessPanel({
  readiness,
  canRun,
  onStart,
  startError,
  pastRuns,
}: {
  readiness: PromotionReadiness;
  canRun: boolean;
  onStart: () => void;
  startError: string | null;
  pastRuns: { id: string; fromSession: string; toSession: string; status: string }[];
}) {
  return (
    <div className="flex flex-col gap-md">
      <div className="surface-3d rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">Readiness &amp; rules</h2>
        <div className="flex flex-col gap-sm text-sm">
          <div className="flex items-center justify-between gap-sm">
            <span className="text-muted-foreground">Session</span>
            <span className="flex items-center gap-1 font-medium text-foreground">
              {readiness.currentSession} <ArrowRight className="size-3 text-muted-foreground" /> {readiness.destinationSession}
            </span>
          </div>
          <div className="flex items-center justify-between gap-sm">
            <span className="text-muted-foreground">Class</span>
            <span className="flex items-center gap-1 font-medium text-foreground">
              {readiness.currentClassName} <ArrowRight className="size-3 text-muted-foreground" /> {readiness.destinationClassName ?? "—"}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-sm border-t border-border pt-sm">
            <div>
              <p className="text-xs text-muted-foreground">Promotion threshold</p>
              <p className="font-medium text-foreground">{readiness.promotionThreshold ?? "—"}%</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Attendance threshold</p>
              <p className="font-medium text-foreground">{readiness.attendanceThreshold ?? "—"}%</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Max failed subjects</p>
              <p className="font-medium text-foreground">{readiness.maxFailedSubjects}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Destination capacity</p>
              <p className="font-medium text-foreground">
                {readiness.destinationCapacityRemaining}/{readiness.destinationCapacityTotal} free
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-sm border-t border-border pt-sm">
            <div>
              <p className="text-xs text-muted-foreground">Missing results</p>
              <p className={`font-medium ${readiness.missingResultCount > 0 ? "text-warning" : "text-foreground"}`}>{readiness.missingResultCount}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Missing attendance</p>
              <p className={`font-medium ${readiness.missingAttendanceCount > 0 ? "text-warning" : "text-foreground"}`}>{readiness.missingAttendanceCount}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-muted-foreground">Exceptions (conditional promotion)</p>
              <p className={`font-medium ${readiness.exceptionCount > 0 ? "text-warning" : "text-foreground"}`}>{readiness.exceptionCount}</p>
            </div>
          </div>
        </div>

        {readiness.blockingIssues.length > 0 && (
          <ul className="mt-sm flex flex-col gap-1 rounded-md border border-warning/30 bg-warning/8 p-sm text-xs text-warning">
            {readiness.blockingIssues.map((issue, i) => (
              <li key={i} className="flex items-start gap-1">
                <AlertTriangle className="mt-0.5 size-3 shrink-0" /> {issue}
              </li>
            ))}
          </ul>
        )}

        {startError && (
          <p className="mt-sm flex items-center gap-1 text-xs text-error">
            <AlertTriangle className="size-3.5 shrink-0" /> {startError}
          </p>
        )}

        <Button className="mt-sm w-full" onClick={onStart} disabled={!canRun}>
          <GraduationCap className="size-3.5" />
          Start promotion run for {readiness.studentCount} student{readiness.studentCount === 1 ? "" : "s"}
        </Button>
      </div>

      {pastRuns.length > 0 && (
        <div className="rounded-lg border border-border bg-surface p-md">
          <p className="mb-sm text-xs font-semibold text-foreground">Runs for this class</p>
          <div className="flex flex-col gap-1">
            {pastRuns.map((r) => (
              <Link key={r.id} href={`/promotion/run?runId=${r.id}`} className="flex items-center justify-between rounded-md border border-border bg-surface px-sm py-2 text-sm outline-none hover:bg-surface-secondary/60 focus-visible:ring-2 focus-visible:ring-ring">
                <span className="text-foreground">
                  {r.fromSession} → {r.toSession}
                </span>
                <Badge tone={r.status === "completed" ? "success" : "neutral"}>{r.status}</Badge>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function academicEligibility(p: PromotionEligibility, readiness: PromotionReadiness): "eligible" | "not-eligible" | "pending" {
  if (p.resultPercent === undefined) return "pending";
  const meetsPercent = readiness.promotionThreshold === undefined || p.resultPercent >= readiness.promotionThreshold;
  const meetsFailed = (p.failedSubjectCount ?? 0) <= readiness.maxFailedSubjects;
  return meetsPercent && meetsFailed ? "eligible" : "not-eligible";
}

export default function PromotionHubPage() {
  const router = useRouter();
  const db = useSisStore();
  const classes = useManagedClasses();
  const { can } = usePermissions();
  const canRun = can("promotion.run");

  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [toSession, setToSession] = useState(nextSessionLabel(CURRENT_SESSION));
  const [rulesOpen, setRulesOpen] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const preview = useMemo(() => (classId ? computePromotionEligibility(db, classId) : []), [db, classId]);
  const readiness = useMemo(() => computePromotionReadiness(db, classId, CURRENT_SESSION, toSession, preview), [db, classId, toSession, preview]);
  const pastRuns = db.promotionRuns.filter((r) => r.classId === classId);

  function handleStart() {
    try {
      const run = createPromotionRun(CURRENT_SESSION, toSession, classId, undefined, ACTOR);
      setStartError(null);
      router.push(`/promotion/run?runId=${run.id}`);
    } catch (err) {
      setStartError(err instanceof Error ? err.message : "Unable to start this promotion run.");
    }
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Promotion</h1>
          <p className="text-xs text-muted-foreground">Review results and attendance, then promote a class into the next session</p>
        </div>
        <div className="flex items-center gap-xs">
          <Button asChild size="sm" variant="outline">
            <Link href="/promotion/history">
              <History className="size-3.5" />
              History
            </Link>
          </Button>
          <Button size="sm" variant="outline" className="lg:hidden" onClick={() => setRulesOpen(true)}>
            <SlidersHorizontal className="size-3.5" />
            Rules
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-xs">
        <Select value={classId} onValueChange={(v) => { setClassId(v); setStartError(null); }}>
          <SelectTrigger className="w-48" aria-label="Class">
            <SelectValue placeholder="Select class" />
          </SelectTrigger>
          <SelectContent>
            {classes.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{CURRENT_SESSION}</span>
        <ArrowRight className="size-3.5 text-muted-foreground" />
        <Input value={toSession} onChange={(e) => setToSession(e.target.value)} className="w-32" aria-label="Destination session" />
      </div>

      <div className="grid grid-cols-1 gap-md lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-sm">
          {preview.length === 0 ? (
            <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
              <span className="flex size-11 items-center justify-center rounded-full bg-surface-secondary text-muted-foreground">
                <UserX className="size-5" />
              </span>
              <p className="text-sm text-muted-foreground">No active students found in this class.</p>
            </div>
          ) : (
            preview.map((p) => {
              const student = db.students.find((s) => s.id === p.studentId);
              const eligibility = academicEligibility(p, readiness);
              return (
                <div key={p.studentId} className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-sm">
                  <div className="flex flex-wrap items-start justify-between gap-sm">
                    <p className="truncate text-sm font-medium text-foreground">{student ? `${student.profile.firstName} ${student.profile.lastName}` : p.studentId}</p>
                    <Badge tone={decisionTone[p.decision] ?? "neutral"}>{promotionDecisionLabels[p.decision]}</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-sm text-xs">
                    <div>
                      <p className="text-muted-foreground">Result</p>
                      <p className="font-medium text-foreground">{p.resultPercent !== undefined ? `${p.resultPercent}%` : "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Attendance</p>
                      <p className="font-medium text-foreground">{p.attendancePercent}%</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Eligibility</p>
                      <p className={`font-medium ${eligibility === "eligible" ? "text-success" : eligibility === "not-eligible" ? "text-error" : "text-muted-foreground"}`}>
                        {eligibility === "eligible" ? "Eligible" : eligibility === "not-eligible" ? "Not eligible" : "Pending result"}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{p.reason}</p>
                </div>
              );
            })
          )}
        </div>

        <div className="hidden lg:block">
          <ReadinessPanel readiness={readiness} canRun={canRun && readiness.canStartRun} onStart={handleStart} startError={startError} pastRuns={pastRuns} />
        </div>
      </div>

      <DetailDrawer open={rulesOpen} onOpenChange={setRulesOpen} title="Readiness & rules" description={`${readiness.currentClassName} · ${readiness.currentSession} → ${readiness.destinationSession}`}>
        <ReadinessPanel readiness={readiness} canRun={canRun && readiness.canStartRun} onStart={handleStart} startError={startError} pastRuns={pastRuns} />
      </DetailDrawer>
    </div>
  );
}
