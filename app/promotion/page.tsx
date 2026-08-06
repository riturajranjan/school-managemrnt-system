"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowRight, GraduationCap, History } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatTile } from "@/components/ui/stat-tile";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useManagedClasses } from "@/lib/hooks/use-academics";
import { useSisStore } from "@/lib/hooks/use-store";
import { CURRENT_SESSION } from "@/lib/data/seed/reference";
import { computePromotionEligibility, createPromotionRun } from "@/lib/services/promotion-service";
import { promotionDecisionLabels } from "@/lib/types/promotion";

const ACTOR = { name: "Academic Coordinator", role: "Academic Coordinator" };

function nextSessionLabel(session: string): string {
  const match = session.match(/(\d{4})-(\d{4})/);
  if (!match) return session;
  return `${Number(match[1]) + 1}-${Number(match[2]) + 1}`;
}

export default function PromotionHubPage() {
  const router = useRouter();
  const db = useSisStore();
  const classes = useManagedClasses();
  const { can } = usePermissions();
  const canRun = can("promotion.run");

  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [toSession, setToSession] = useState(nextSessionLabel(CURRENT_SESSION));

  const preview = useMemo(() => (classId ? computePromotionEligibility(db, classId) : []), [db, classId]);
  const counts = {
    promote: preview.filter((p) => p.decision === "promote").length,
    conditional: preview.filter((p) => p.decision === "conditional-promotion").length,
    retain: preview.filter((p) => p.decision === "retain").length,
    pending: preview.filter((p) => p.decision === "pending").length,
  };

  const pastRuns = db.promotionRuns.filter((r) => r.classId === classId);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Promotion</h1>
          <p className="text-xs text-muted-foreground">Review results and attendance, then promote a class into the next session</p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href="/promotion/history">
            <History className="size-3.5" />
            History
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-xs">
        <Select value={classId} onValueChange={setClassId}>
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

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Promote" value={String(counts.promote)} tone="success" />
        <StatTile label="Conditional" value={String(counts.conditional)} tone="warning" />
        <StatTile label="Retain" value={String(counts.retain)} tone="error" />
        <StatTile label="Pending review" value={String(counts.pending)} tone="neutral" />
      </div>

      {canRun && (
        <Button
          onClick={() => {
            const run = createPromotionRun(CURRENT_SESSION, toSession, classId, undefined, ACTOR);
            router.push(`/promotion/run?runId=${run.id}`);
          }}
          disabled={!classId || preview.length === 0}
        >
          <GraduationCap className="size-3.5" />
          Start promotion run for {preview.length} student{preview.length === 1 ? "" : "s"}
        </Button>
      )}

      {pastRuns.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold text-foreground">Runs for this class</p>
          {pastRuns.map((r) => (
            <Link key={r.id} href={`/promotion/run?runId=${r.id}`} className="flex items-center justify-between rounded-md border border-border bg-surface px-sm py-2 text-sm outline-none hover:bg-surface-secondary/60 focus-visible:ring-2 focus-visible:ring-ring">
              <span className="text-foreground">
                {r.fromSession} → {r.toSession}
              </span>
              <Badge tone={r.status === "completed" ? "success" : "neutral"}>{r.status}</Badge>
            </Link>
          ))}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-secondary/60 text-left">
              <th className="px-sm py-2 text-xs font-semibold text-muted-foreground">Student</th>
              <th className="px-sm py-2 text-xs font-semibold text-muted-foreground">Result</th>
              <th className="px-sm py-2 text-xs font-semibold text-muted-foreground">Attendance</th>
              <th className="px-sm py-2 text-right text-xs font-semibold text-muted-foreground">Preview decision</th>
            </tr>
          </thead>
          <tbody>
            {preview.map((p) => {
              const student = db.students.find((s) => s.id === p.studentId);
              return (
                <tr key={p.studentId} className="border-b border-border last:border-0">
                  <td className="px-sm py-2 text-foreground">{student ? `${student.profile.firstName} ${student.profile.lastName}` : p.studentId}</td>
                  <td className="px-sm py-2 text-foreground">{p.resultPercent !== undefined ? `${p.resultPercent}%` : "—"}</td>
                  <td className="px-sm py-2 text-foreground">{p.attendancePercent}%</td>
                  <td className="px-sm py-2 text-right">
                    <Badge tone={p.decision === "promote" ? "success" : p.decision === "conditional-promotion" ? "warning" : p.decision === "retain" ? "error" : "neutral"}>
                      {promotionDecisionLabels[p.decision]}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
