"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { findClass, findSection } from "@/lib/data/seed/reference";
import { CURRENT_TEACHER_ID } from "@/lib/current-user";
import { useSisStore } from "@/lib/hooks/use-store";
import { homeworkStatusTone } from "@/lib/types/academics";
import { formatDate } from "@/lib/utils";

export default function TeacherHomeworkPage() {
  const db = useSisStore();
  const myHomework = db.homework.filter((h) => h.teacherId === CURRENT_TEACHER_ID);

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

      <div className="flex flex-col gap-sm">
        {myHomework.map((h) => {
          const submissions = db.homeworkSubmissions.filter((s) => s.homeworkId === h.id);
          const submitted = submissions.filter((s) => s.status !== "not-submitted").length;
          return (
            <Link key={h.id} href={`/academics/homework/${h.id}`} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm hover:bg-surface-secondary/60">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{h.title}</p>
                <p className="text-xs text-muted-foreground">
                  {findClass(h.classId)?.name}-{findSection(h.sectionId)?.section.name} · Due {formatDate(h.dueDate)} · {submitted}/{submissions.length} submitted
                </p>
              </div>
              <Badge tone={homeworkStatusTone[h.status]}>{h.status.replace("-", " ")}</Badge>
            </Link>
          );
        })}
        {myHomework.length === 0 && <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No homework created yet.</p>}
      </div>
    </div>
  );
}
