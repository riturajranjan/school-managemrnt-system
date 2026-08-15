"use client";

// Homework detail (Phase 9B) — real PostgreSQL/API cutover. The old page's
// "student submission" panel read `db.students[0]` — not a real logged-in
// student's identity (no student self-context/portal exists yet) — so it's
// removed rather than carried forward as a fake self-view; homework.view-only
// visitors now see the same real detail read-only. Submissions/grading were
// mock-only and are dropped (see prisma/schema.prisma's Homework doc comment).
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { CalendarClock, Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input } from "@/components/ui/input";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useHomework, closeHomeworkRequest, duplicateHomeworkRequest, publishHomeworkRequest, updateHomeworkRequest } from "@/lib/hooks/api/use-homework-api";
import type { HomeworkStatusDto } from "@/lib/api/contracts";
import { formatDate } from "@/lib/utils";

const statusTone: Record<HomeworkStatusDto, "neutral" | "info" | "success"> = { draft: "neutral", published: "info", closed: "success" };

export default function HomeworkDetailPage() {
  const params = useParams<{ homeworkId: string }>();
  const { can } = usePermissions();
  const { data: homework, loading, error, reload } = useHomework(params.homeworkId);
  const [extendOpen, setExtendOpen] = useState(false);
  const [newDueDate, setNewDueDate] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) return <p className="py-2xl text-center text-sm text-muted-foreground">Loading…</p>;
  if (error || !homework) {
    return (
      <div className="flex flex-col items-center gap-sm py-2xl text-center">
        <p className="text-sm font-medium text-foreground">{error ?? "Homework not found"}</p>
        <Button asChild variant="outline">
          <Link href="/academics/homework">Back to Homework</Link>
        </Button>
      </div>
    );
  }

  const canManage = can("homework.manage");

  async function run(action: () => Promise<{ success: boolean; error?: { message: string } }>) {
    setBusy(true);
    setActionError(null);
    const res = await action();
    if (!res.success) setActionError(res.error?.message ?? "Something went wrong");
    else reload();
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-sm sm:flex-row sm:items-start sm:justify-between sm:p-md">
        <div>
          <div className="flex items-center gap-xs">
            <h1 className="text-base font-semibold text-foreground">{homework.title}</h1>
            <Badge tone={statusTone[homework.status]}>{homework.status}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {homework.subject.name} · {homework.section.className}-{homework.section.name} · {homework.teacher.name}
          </p>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarClock className="size-3" /> Due {formatDate(homework.dueAt)} · {homework.studentCount} student{homework.studentCount === 1 ? "" : "s"}
          </p>
          <p className="mt-1 text-sm text-foreground">{homework.description}</p>
          {homework.instructions && <p className="mt-1 text-sm text-muted-foreground">{homework.instructions}</p>}
        </div>

        {canManage && (
          <div className="flex flex-wrap gap-xs">
            {homework.status === "draft" && (
              <Button size="sm" disabled={busy} onClick={() => run(() => publishHomeworkRequest(homework.id))}>
                Publish
              </Button>
            )}
            {homework.status === "published" && (
              <>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => { setNewDueDate(homework.dueAt); setExtendOpen(true); }}>
                  Extend deadline
                </Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => closeHomeworkRequest(homework.id))}>
                  Close
                </Button>
              </>
            )}
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => run(async () => {
                const res = await duplicateHomeworkRequest(homework.id);
                return res;
              })}
            >
              <Copy className="size-3.5" />
              Duplicate
            </Button>
          </div>
        )}
      </div>

      {actionError && <p className="rounded-md border border-error/30 bg-error/10 p-sm text-xs text-error">{actionError}</p>}

      <DetailDrawer open={extendOpen} onOpenChange={setExtendOpen} title="Extend deadline" description="Choose a new due date">
        <div className="flex flex-col gap-sm">
          <Input type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} />
          <Button
            disabled={!newDueDate || busy}
            onClick={() =>
              run(async () => {
                const res = await updateHomeworkRequest(homework.id, { dueAt: newDueDate });
                if (res.success) setExtendOpen(false);
                return res;
              })
            }
          >
            Extend
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
