"use client";

import Link from "next/link";
import { use, useState } from "react";
import { CalendarClock, CheckCircle2, Copy, Send } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submissionTypeLabels } from "@/components/academics/homework/homework-meta";
import { usePermissions } from "@/components/providers/permissions-provider";
import { findClass, findSection } from "@/lib/data/seed/reference";
import { teacherById } from "@/lib/data/seed/academics";
import { useHomeworkList, useHomeworkSubmissions, useSubjects } from "@/lib/hooks/use-academics";
import { useSisStore } from "@/lib/hooks/use-store";
import { closeHomework, duplicateHomework, extendDeadline, gradeSubmission, publishHomework, requestResubmission, submitHomework } from "@/lib/services/homework-service";
import { homeworkStatusTone, submissionStatusTone, type HomeworkSubmission } from "@/lib/types/academics";
import { formatDate, initialsOf } from "@/lib/utils";

export default function HomeworkDetailPage({ params }: { params: Promise<{ homeworkId: string }> }) {
  const { homeworkId } = use(params);
  const homeworkList = useHomeworkList();
  const subjects = useSubjects();
  const submissions = useHomeworkSubmissions(homeworkId);
  const db = useSisStore();
  const { can } = usePermissions();
  const [grading, setGrading] = useState<HomeworkSubmission | null>(null);
  const [marks, setMarks] = useState("");
  const [feedback, setFeedback] = useState("");
  const [extendOpen, setExtendOpen] = useState(false);
  const [newDueDate, setNewDueDate] = useState("");

  const homework = homeworkList.find((h) => h.id === homeworkId);

  if (!homework) {
    return (
      <div className="flex flex-col items-center gap-sm py-2xl text-center">
        <p className="text-sm font-medium text-foreground">Homework not found</p>
        <Button asChild variant="outline">
          <Link href="/academics/homework">Back to Homework</Link>
        </Button>
      </div>
    );
  }

  const studentsInSection = db.students.filter((s) => s.sectionId === homework.sectionId);
  const submittedCount = submissions.filter((s) => s.status !== "not-submitted").length;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-sm sm:flex-row sm:items-start sm:justify-between sm:p-md">
        <div>
          <div className="flex items-center gap-xs">
            <h1 className="text-base font-semibold text-foreground">{homework.title}</h1>
            <Badge tone={homeworkStatusTone[homework.status]}>{homework.status.replace("-", " ")}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {subjects.find((s) => s.id === homework.subjectId)?.name} · {findClass(homework.classId)?.name}-{findSection(homework.sectionId)?.section.name} ·{" "}
            {teacherById(homework.teacherId)?.name}
          </p>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarClock className="size-3" /> Due {formatDate(homework.dueDate)} · Max marks {homework.maxMarks} · {submissionTypeLabels[homework.submissionType]}
          </p>
          <p className="mt-1 text-sm text-foreground">{homework.description}</p>
        </div>

        {can("homework.manage") && (
          <div className="flex flex-wrap gap-xs">
            {homework.status === "draft" && (
              <Button size="sm" onClick={() => publishHomework(homework.id)}>
                Publish
              </Button>
            )}
            {(homework.status === "published" || homework.status === "due-soon" || homework.status === "overdue") && (
              <>
                <Button size="sm" variant="outline" onClick={() => setExtendOpen(true)}>
                  Extend deadline
                </Button>
                <Button size="sm" variant="outline" onClick={() => closeHomework(homework.id)}>
                  Close
                </Button>
              </>
            )}
            <Button size="sm" variant="ghost" onClick={() => duplicateHomework(homework.id)}>
              <Copy className="size-3.5" />
              Duplicate
            </Button>
          </div>
        )}
      </div>

      {can("homework.manage") ? (
        <div className="rounded-lg border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border p-sm">
            <h2 className="text-sm font-semibold text-foreground">Submissions</h2>
            <span className="text-xs text-muted-foreground">
              {submittedCount}/{studentsInSection.length} submitted
            </span>
          </div>
          <ul className="divide-y divide-border">
            {studentsInSection.map((student) => {
              const submission = submissions.find((s) => s.studentId === student.id);
              return (
                <li key={student.id} className="flex items-center gap-sm p-sm">
                  <Avatar className="size-8">
                    <AvatarFallback>{initialsOf(student.profile.firstName, student.profile.lastName)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {student.profile.firstName} {student.profile.lastName}
                    </p>
                    {submission?.marksObtained !== undefined && <p className="text-xs text-muted-foreground">{submission.marksObtained}/{homework.maxMarks}</p>}
                  </div>
                  <Badge tone={submissionStatusTone[submission?.status ?? "not-submitted"]}>{(submission?.status ?? "not-submitted").replace("-", " ")}</Badge>
                  {submission && submission.status !== "not-submitted" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setGrading(submission);
                        setMarks(String(submission.marksObtained ?? ""));
                        setFeedback(submission.feedback ?? "");
                      }}
                    >
                      Review
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <StudentSubmissionPanel homeworkId={homework.id} maxMarks={homework.maxMarks} />
      )}

      <DetailDrawer open={grading !== null} onOpenChange={(open) => !open && setGrading(null)} title="Grade submission" description="Assign marks and feedback">
        {grading && (
          <div className="flex flex-col gap-sm">
            {grading.content && <p className="rounded-md bg-surface-secondary p-sm text-sm text-foreground">{grading.content}</p>}
            {grading.fileNames.length > 0 && <p className="text-xs text-muted-foreground">Files: {grading.fileNames.join(", ")}</p>}
            <div>
              <Label htmlFor="grade-marks">Marks (out of {homework.maxMarks})</Label>
              <Input id="grade-marks" type="number" value={marks} onChange={(e) => setMarks(e.target.value)} max={homework.maxMarks} />
            </div>
            <div>
              <Label htmlFor="grade-feedback">Feedback</Label>
              <Textarea id="grade-feedback" rows={3} value={feedback} onChange={(e) => setFeedback(e.target.value)} />
            </div>
            <div className="flex gap-sm">
              <Button
                onClick={() => {
                  gradeSubmission(grading.id, Number(marks) || 0, feedback);
                  setGrading(null);
                }}
              >
                <CheckCircle2 className="size-3.5" />
                Save grade
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  requestResubmission(grading.id, feedback || "Please review and resubmit.");
                  setGrading(null);
                }}
              >
                Request resubmission
              </Button>
            </div>
          </div>
        )}
      </DetailDrawer>

      <DetailDrawer open={extendOpen} onOpenChange={setExtendOpen} title="Extend deadline" description="Choose a new due date">
        <div className="flex flex-col gap-sm">
          <Input type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} />
          <Button
            disabled={!newDueDate}
            onClick={() => {
              extendDeadline(homework.id, new Date(newDueDate).toISOString());
              setExtendOpen(false);
            }}
          >
            Extend
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}

function StudentSubmissionPanel({ homeworkId, maxMarks }: { homeworkId: string; maxMarks: number }) {
  const db = useSisStore();
  const submissions = useHomeworkSubmissions(homeworkId);
  const student = db.students[0];
  const mySubmission = submissions.find((s) => s.studentId === student?.id);
  const [content, setContent] = useState(mySubmission?.content ?? "");

  return (
    <div className="rounded-lg border border-border bg-surface p-md">
      <h2 className="mb-sm text-sm font-semibold text-foreground">Your submission</h2>
      {mySubmission?.status === "evaluated" ? (
        <div className="flex flex-col gap-sm">
          <Badge tone="success">Evaluated — {mySubmission.marksObtained}/{maxMarks}</Badge>
          {mySubmission.feedback && <p className="text-sm text-muted-foreground">{mySubmission.feedback}</p>}
        </div>
      ) : (
        <div className="flex flex-col gap-sm">
          {mySubmission && <Badge tone={submissionStatusTone[mySubmission.status]}>{mySubmission.status.replace("-", " ")}</Badge>}
          <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Type your answer or notes here…" rows={4} />
          <Button
            className="self-start"
            onClick={() => {
              if (student) submitHomework(homeworkId, student.id, content, []);
            }}
          >
            <Send className="size-3.5" />
            Submit
          </Button>
        </div>
      )}
    </div>
  );
}
