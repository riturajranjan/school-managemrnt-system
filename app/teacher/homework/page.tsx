"use client";

// My homework (Phase 9B) — real PostgreSQL/API cutover. The authenticated
// teacher's own homework only, resolved via their real Staff.id server-side
// (GET /api/homework/mine) — never the fake CURRENT_TEACHER_ID.
import Link from "next/link";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMyHomeworkList } from "@/lib/hooks/api/use-homework-api";
import type { HomeworkStatusDto } from "@/lib/api/contracts";
import { formatDate } from "@/lib/utils";

const statusTone: Record<HomeworkStatusDto, "neutral" | "info" | "success"> = { draft: "neutral", published: "info", closed: "success" };

export default function TeacherHomeworkPage() {
  const { data: myHomework, loading, error } = useMyHomeworkList();

  return (
    <div className="flex flex-col gap-md">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">My homework</h1>
          <p className="text-xs text-muted-foreground">Assignments you&apos;ve created</p>
        </div>
        <Button asChild size="sm">
          <Link href="/academics/homework/new">
            <Plus className="size-3.5" />
            Create homework
          </Link>
        </Button>
      </div>

      {error ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">{error}</p>
      ) : loading && myHomework.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="flex flex-col gap-sm">
          {myHomework.map((h) => (
            <Link key={h.id} href={`/academics/homework/${h.id}`} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm hover:bg-surface-secondary/60">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{h.title}</p>
                <p className="text-xs text-muted-foreground">
                  {h.section.className}-{h.section.name} · Due {formatDate(h.dueAt)} · {h.studentCount} student{h.studentCount === 1 ? "" : "s"}
                </p>
              </div>
              <Badge tone={statusTone[h.status]}>{h.status}</Badge>
            </Link>
          ))}
          {myHomework.length === 0 && <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No homework created yet — this needs a real teaching Staff profile linked to your account.</p>}
        </div>
      )}
    </div>
  );
}
