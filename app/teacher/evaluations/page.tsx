"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CURRENT_TEACHER_ID } from "@/lib/current-user";
import { useSisStore } from "@/lib/hooks/use-store";
import { gradeSubmission } from "@/lib/services/homework-service";
import type { HomeworkSubmission } from "@/lib/types/academics";
import { initialsOf } from "@/lib/utils";

export default function TeacherEvaluationsPage() {
  const db = useSisStore();
  const [grading, setGrading] = useState<{ submission: HomeworkSubmission; maxMarks: number; title: string } | null>(null);
  const [marks, setMarks] = useState("");
  const [feedback, setFeedback] = useState("");

  const myHomeworkIds = new Set(db.homework.filter((h) => h.teacherId === CURRENT_TEACHER_ID).map((h) => h.id));
  const pending = db.homeworkSubmissions.filter((s) => myHomeworkIds.has(s.homeworkId) && s.status === "submitted");

  return (
    <div className="flex flex-col gap-md">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Evaluations</h1>
        <p className="text-xs text-muted-foreground">{pending.length} submission(s) awaiting grading</p>
      </div>

      <div className="flex flex-col gap-sm">
        {pending.map((sub) => {
          const homework = db.homework.find((h) => h.id === sub.homeworkId)!;
          const student = db.students.find((s) => s.id === sub.studentId);
          return (
            <div key={sub.id} className="flex items-center gap-sm rounded-lg border border-border bg-surface p-sm">
              <Avatar className="size-8">
                <AvatarFallback>{student ? initialsOf(student.profile.firstName, student.profile.lastName) : "?"}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{student ? `${student.profile.firstName} ${student.profile.lastName}` : sub.studentId}</p>
                <p className="truncate text-xs text-muted-foreground">{homework.title}</p>
              </div>
              <Badge tone="info">submitted</Badge>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setGrading({ submission: sub, maxMarks: homework.maxMarks, title: homework.title });
                  setMarks("");
                  setFeedback("");
                }}
              >
                Grade
              </Button>
            </div>
          );
        })}
        {pending.length === 0 && <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Nothing pending — you&apos;re all caught up.</p>}
      </div>

      <DetailDrawer open={grading !== null} onOpenChange={(open) => !open && setGrading(null)} title="Grade submission" description={grading?.title}>
        {grading && (
          <div className="flex flex-col gap-sm">
            {grading.submission.content && <p className="rounded-md bg-surface-secondary p-sm text-sm text-foreground">{grading.submission.content}</p>}
            <div>
              <Label htmlFor="eval-marks">Marks (out of {grading.maxMarks})</Label>
              <Input id="eval-marks" type="number" value={marks} onChange={(e) => setMarks(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="eval-feedback">Feedback</Label>
              <Textarea id="eval-feedback" rows={3} value={feedback} onChange={(e) => setFeedback(e.target.value)} />
            </div>
            <Button
              onClick={() => {
                gradeSubmission(grading.submission.id, Number(marks) || 0, feedback);
                setGrading(null);
              }}
            >
              <CheckCircle2 className="size-3.5" />
              Save grade
            </Button>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
