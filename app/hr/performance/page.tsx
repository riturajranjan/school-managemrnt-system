"use client";

// Performance (Production migration, Phase B, HR Sub-batch 3) — real
// PostgreSQL/API cutover. Deliberately simple: one review record per
// (staff, reviewer, period), 4-state lifecycle — no PerformanceCycle/
// PerformanceGoal/Feedback multi-stage workflow (those stay mock:
// /hr/appraisals, /hr/goals, /hr/feedback). hr.view/hr.manage RBAC, no new
// permission. visibleToEmployee is an explicit opt-in — never inferred from
// status alone — controlling whether a COMPLETED review ever reaches the
// employee's self-service view.
import Link from "next/link";
import { useState } from "react";
import { Award, MessagesSquare, Plus, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatTile } from "@/components/ui/stat-tile";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { createPerformanceReviewRequest, setPerformanceReviewStatusRequest, usePerformanceReviews } from "@/lib/hooks/api/use-hr-api";
import { useStaffList } from "@/lib/hooks/api/use-staff-api";
import { roleLabels } from "@/lib/permissions/roles";
import type { PerformanceReviewDto, PerformanceReviewStatusDto } from "@/lib/api/contracts";
import { formatDate } from "@/lib/utils";

const statusLabels: Record<PerformanceReviewStatusDto, string> = { draft: "Draft", "in-review": "In review", completed: "Completed", archived: "Archived" };
const statusTone: Record<PerformanceReviewStatusDto, "success" | "warning" | "error" | "neutral" | "info"> = {
  draft: "neutral", "in-review": "warning", completed: "success", archived: "neutral",
};
const NEXT_STATUS: Record<PerformanceReviewStatusDto, PerformanceReviewStatusDto[]> = {
  draft: ["in-review", "archived"],
  "in-review": ["completed", "archived"],
  completed: ["archived"],
  archived: [],
};

export default function PerformancePage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: reviews, loading, error, reload } = usePerformanceReviews();
  const { data: staff } = useStaffList({ status: "active", pageSize: 500 });
  const [createOpen, setCreateOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [staffId, setStaffId] = useState("");
  const [reviewerId, setReviewerId] = useState("");
  const [reviewPeriodStart, setReviewPeriodStart] = useState("");
  const [reviewPeriodEnd, setReviewPeriodEnd] = useState("");
  const [reviewDate, setReviewDate] = useState("");
  const [overallRating, setOverallRating] = useState("");
  const [summary, setSummary] = useState("");
  const [comments, setComments] = useState("");
  const [goals, setGoals] = useState("");
  const [visibleToEmployee, setVisibleToEmployee] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (!capabilitiesLoading && !hasServerPermission("hr.view") && !hasServerPermission("hr.manage")) {
    return <PermissionDenied action="view performance" role={roleLabels[role]} backHref="/hr" />;
  }
  const canManage = hasServerPermission("hr.manage");

  const draft = reviews.filter((r) => r.status === "draft").length;
  const inReview = reviews.filter((r) => r.status === "in-review").length;
  const completed = reviews.filter((r) => r.status === "completed").length;

  function resetForm() {
    setStaffId(""); setReviewerId(""); setReviewPeriodStart(""); setReviewPeriodEnd(""); setReviewDate("");
    setOverallRating(""); setSummary(""); setComments(""); setGoals(""); setVisibleToEmployee(false); setFormError(null);
  }

  async function submit() {
    setFormError(null);
    if (!staffId || !reviewerId || !reviewPeriodStart || !reviewPeriodEnd) return setFormError("Employee, reviewer, and review period are required.");
    if (staffId === reviewerId) return setFormError("A reviewer cannot review themselves.");
    const res = await createPerformanceReviewRequest({
      staffId, reviewerId, reviewPeriodStart, reviewPeriodEnd,
      reviewDate: reviewDate || undefined,
      overallRating: overallRating ? Number(overallRating) : undefined,
      summary: summary.trim() || undefined,
      comments: comments.trim() || undefined,
      goals: goals.trim() || undefined,
      visibleToEmployee,
    });
    if (!res.success) return setFormError(res.error.message);
    resetForm();
    setCreateOpen(false);
    reload();
  }

  async function transition(review: PerformanceReviewDto, status: PerformanceReviewStatusDto) {
    setBusyId(review.id);
    await setPerformanceReviewStatusRequest(review.id, status);
    setBusyId(null);
    reload();
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Performance</h1>
          <p className="text-xs text-muted-foreground">Reviews are presented for development and structured feedback — never as a public ranking.</p>
        </div>
        <div className="flex flex-wrap items-center gap-xs">
          <Button asChild size="sm" variant="outline"><Link href="/hr/appraisals"><Award className="size-3.5" /> Appraisals</Link></Button>
          <Button asChild size="sm" variant="outline"><Link href="/hr/goals"><Target className="size-3.5" /> Goals</Link></Button>
          <Button asChild size="sm" variant="outline"><Link href="/hr/feedback"><MessagesSquare className="size-3.5" /> Feedback</Link></Button>
          {canManage && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-3.5" /> New review
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Total reviews" value={String(reviews.length)} icon={Award} tone="neutral" />
        <StatTile label="Draft" value={String(draft)} icon={Award} tone="neutral" />
        <StatTile label="In review" value={String(inReview)} icon={Award} tone={inReview > 0 ? "warning" : "success"} />
        <StatTile label="Completed" value={String(completed)} icon={Award} tone="success" />
      </div>

      {error && (
        <div className="rounded-lg border border-error/30 bg-error/5 p-md text-sm text-error" role="alert">
          Could not load reviews: {error}
        </div>
      )}

      <div className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">Reviews</h2>
        {loading && reviews.length === 0 ? (
          <p className="py-md text-center text-sm text-muted-foreground">Loading reviews…</p>
        ) : reviews.length === 0 ? (
          <p className="py-md text-center text-sm text-muted-foreground">No performance reviews found.</p>
        ) : (
          <div className="flex flex-col gap-sm">
            {reviews.map((r) => (
              <div key={r.id} className="flex flex-col gap-sm rounded-md border border-border p-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    <Link href={`/hr/staff/${r.staffId}`} className="hover:underline">{r.staffName}</Link>
                    <span className="font-normal text-muted-foreground"> · {r.employeeCode}</span>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatDate(r.reviewPeriodStart)} – {formatDate(r.reviewPeriodEnd)} · Reviewer: {r.reviewerName}
                    {r.overallRating ? ` · Rating: ${r.overallRating}/5` : ""}
                    {r.status === "completed" && ` · ${r.visibleToEmployee ? "Visible to employee" : "Not shared with employee"}`}
                  </p>
                </div>
                <div className="flex items-center gap-xs">
                  <Badge tone={statusTone[r.status]}>{statusLabels[r.status]}</Badge>
                  {canManage && NEXT_STATUS[r.status].length > 0 && (
                    <Select value="" onValueChange={(v) => transition(r, v as PerformanceReviewStatusDto)}>
                      <SelectTrigger className="h-8 w-auto text-xs" disabled={busyId === r.id} aria-label="Change status">
                        <SelectValue placeholder="Change status" />
                      </SelectTrigger>
                      <SelectContent>
                        {NEXT_STATUS[r.status].map((s) => <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {canManage && (
        <DetailDrawer open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) resetForm(); }} title="New performance review" description="Create a real performance review">
          <div className="flex flex-col gap-sm">
            <div>
              <Label>Employee</Label>
              <Select value={staffId} onValueChange={setStaffId}>
                <SelectTrigger aria-label="Employee"><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>{staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reviewer</Label>
              <Select value={reviewerId} onValueChange={setReviewerId}>
                <SelectTrigger aria-label="Reviewer"><SelectValue placeholder="Select reviewer" /></SelectTrigger>
                <SelectContent>{staff.filter((s) => s.id !== staffId).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-sm">
              <div>
                <Label htmlFor="rev-start">Period start</Label>
                <Input id="rev-start" type="date" value={reviewPeriodStart} onChange={(e) => setReviewPeriodStart(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="rev-end">Period end</Label>
                <Input id="rev-end" type="date" value={reviewPeriodEnd} onChange={(e) => setReviewPeriodEnd(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-sm">
              <div>
                <Label htmlFor="rev-date">Review date (optional)</Label>
                <Input id="rev-date" type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} />
              </div>
              <div>
                <Label>Overall rating (optional)</Label>
                <Select value={overallRating} onValueChange={setOverallRating}>
                  <SelectTrigger aria-label="Overall rating"><SelectValue placeholder="1–5" /></SelectTrigger>
                  <SelectContent>{[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="rev-summary">Summary</Label>
              <Textarea id="rev-summary" value={summary} onChange={(e) => setSummary(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="rev-comments">Comments / feedback</Label>
              <Textarea id="rev-comments" value={comments} onChange={(e) => setComments(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="rev-goals">Goals (optional)</Label>
              <Textarea id="rev-goals" value={goals} onChange={(e) => setGoals(e.target.value)} />
            </div>
            <label className="flex items-center gap-sm text-sm text-foreground">
              <Checkbox checked={visibleToEmployee} onCheckedChange={(v) => setVisibleToEmployee(v === true)} />
              Share with employee once completed (self-service)
            </label>
            {formError && <p className="text-sm text-error">{formError}</p>}
            <Button onClick={submit}>Create review</Button>
          </div>
        </DetailDrawer>
      )}
    </div>
  );
}
