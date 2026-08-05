"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpenCheck,
  CalendarCheck,
  ClipboardList,
  MessageSquare,
  Sparkles,
  Wand2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatTile } from "@/components/ui/stat-tile";
import { CURRENT_TEACHER_ID, CURRENT_TEACHER_NAME } from "@/lib/current-user";
import { useSisStore } from "@/lib/hooks/use-store";
import { buildTeacherDay, currentAndNextClass } from "@/lib/selectors/teacher-day";
import { draftParentMessage, generateRevisionActivity, summarizeClassPerformance } from "@/lib/services/teacher-ai-service";
import { homeworkStatusTone, lessonPlanStatusTone } from "@/lib/types/academics";
import { formatDate } from "@/lib/utils";

export default function TeacherMyDayPage() {
  const db = useSisStore();
  const [aiOpen, setAiOpen] = useState<null | "message" | "summary" | "revision">(null);
  const [aiTopic, setAiTopic] = useState("");
  const [aiResult, setAiResult] = useState("");

  const dayItems = useMemo(() => buildTeacherDay(db, CURRENT_TEACHER_ID), [db]);
  const { current, next } = currentAndNextClass(dayItems);

  const mySections = useMemo(() => [...new Set(db.subjectAssignments.filter((a) => a.primaryTeacherId === CURRENT_TEACHER_ID).map((a) => a.sectionId))], [db.subjectAssignments]);
  const myStudentIds = useMemo(() => new Set(db.students.filter((s) => mySections.includes(s.sectionId)).map((s) => s.id)), [db.students, mySections]);
  const myAlerts = useMemo(() => db.studentSupportAlerts.filter((a) => myStudentIds.has(a.studentId) && !a.resolved).slice(0, 6), [db.studentSupportAlerts, myStudentIds]);

  const pendingLessonPlans = db.lessonPlans.filter((p) => p.teacherId === CURRENT_TEACHER_ID && p.status === "draft").length;
  const homeworkPendingReview = db.homework.filter((h) => h.teacherId === CURRENT_TEACHER_ID).reduce((sum, h) => sum + db.homeworkSubmissions.filter((s) => s.homeworkId === h.id && s.status === "submitted").length, 0);
  const attendancePendingCount = dayItems.filter((i) => i.kind === "class" && i.status !== "upcoming").length;
  const myHomework = db.homework.filter((h) => h.teacherId === CURRENT_TEACHER_ID).slice(0, 5);
  const myLessonPlans = db.lessonPlans.filter((p) => p.teacherId === CURRENT_TEACHER_ID).slice(0, 5);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="flex flex-col gap-md pb-24 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">
          {greeting}, {CURRENT_TEACHER_NAME.split(" ")[0]}
        </h1>
        <p className="text-xs text-muted-foreground">{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</p>
      </div>

      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
        <div className={`rounded-lg border p-sm ${current ? "border-primary bg-primary/5" : "border-border bg-surface"}`}>
          <p className="text-xs font-medium text-muted-foreground">Current class</p>
          {current ? (
            <>
              <p className="text-sm font-semibold text-foreground">{current.title}</p>
              <p className="text-xs text-muted-foreground">{current.startTime} – {current.endTime}</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No class in session</p>
          )}
        </div>
        <div className="rounded-lg border border-border bg-surface p-sm">
          <p className="text-xs font-medium text-muted-foreground">Next class</p>
          {next ? (
            <>
              <p className="text-sm font-semibold text-foreground">{next.title}</p>
              <p className="text-xs text-muted-foreground">{next.startTime} – {next.endTime}</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No more classes today</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-xs">
        <Button asChild size="sm">
          <Link href="/attendance/students">
            <CalendarCheck className="size-3.5" />
            Mark attendance
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/academics/homework/new">Create homework</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/teacher/lesson-plans">Open lesson plan</Link>
        </Button>
        <Button size="sm" variant="outline" onClick={() => setAiOpen("message")}>
          <Sparkles className="size-3.5" />
          AI assistant
        </Button>
      </div>

      <section className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Classes today" value={String(dayItems.filter((i) => i.kind === "class").length)} icon={ClipboardList} tone="info" />
        <StatTile label="Attendance pending" value={String(Math.max(0, attendancePendingCount))} icon={CalendarCheck} tone="warning" />
        <StatTile label="Homework to review" value={String(homeworkPendingReview)} icon={BookOpenCheck} tone="warning" />
        <StatTile label="Lesson plans pending" value={String(pendingLessonPlans)} icon={ClipboardList} tone={pendingLessonPlans > 0 ? "error" : "success"} />
      </section>

      <div className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">Today&apos;s timeline</h2>
        {dayItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing scheduled today.</p>
        ) : (
          <ol className="flex flex-col gap-1">
            {dayItems.map((item) => (
              <li key={item.id}>
                {item.href ? (
                  <Link
                    href={item.href}
                    className={`flex items-center justify-between gap-sm rounded-md border p-sm text-sm ${item.status === "current" ? "border-primary bg-primary/5" : "border-border bg-surface hover:bg-surface-secondary/60"}`}
                  >
                    <span className="text-foreground">{item.title}</span>
                    <span className="text-xs text-muted-foreground">{item.startTime ?? ""}</span>
                  </Link>
                ) : (
                  <div className="flex items-center justify-between gap-sm rounded-md border border-border bg-surface p-sm text-sm">
                    <span className="text-foreground">{item.title}</span>
                    <span className="text-xs text-muted-foreground">{item.startTime ?? ""}</span>
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>

      {myAlerts.length > 0 && (
        <div className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm flex items-center gap-1 text-sm font-semibold text-foreground">
            <AlertTriangle className="size-4 text-warning" /> Student support alerts
          </h2>
          <ul className="flex flex-col gap-sm">
            {myAlerts.map((alert) => {
              const student = db.students.find((s) => s.id === alert.studentId);
              return (
                <li key={alert.id} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{student ? `${student.profile.firstName} ${student.profile.lastName}` : alert.studentId}</p>
                    <p className="text-xs text-muted-foreground">{alert.detail}</p>
                  </div>
                  <Badge tone={alert.severity === "high" ? "error" : alert.severity === "medium" ? "warning" : "info"}>{alert.severity}</Badge>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-md">
          <div className="mb-sm flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Homework</h2>
            <Link href="/academics/homework" className="text-xs font-medium text-primary hover:underline">
              View all
            </Link>
          </div>
          <ul className="flex flex-col gap-1">
            {myHomework.map((h) => (
              <li key={h.id} className="flex items-center justify-between text-sm">
                <Link href={`/academics/homework/${h.id}`} className="truncate text-foreground hover:underline">
                  {h.title}
                </Link>
                <Badge tone={homeworkStatusTone[h.status]}>{h.status.replace("-", " ")}</Badge>
              </li>
            ))}
            {myHomework.length === 0 && <p className="text-sm text-muted-foreground">No homework yet.</p>}
          </ul>
        </div>

        <div className="rounded-lg border border-border bg-surface p-md">
          <div className="mb-sm flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Lesson plans</h2>
            <Link href="/teacher/lesson-plans" className="text-xs font-medium text-primary hover:underline">
              View all
            </Link>
          </div>
          <ul className="flex flex-col gap-1">
            {myLessonPlans.map((p) => (
              <li key={p.id} className="flex items-center justify-between text-sm">
                <span className="text-foreground">{formatDate(p.date)} · P{p.period}</span>
                <Badge tone={lessonPlanStatusTone[p.status]}>{p.status}</Badge>
              </li>
            ))}
            {myLessonPlans.length === 0 && <p className="text-sm text-muted-foreground">No lesson plans yet.</p>}
          </ul>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-md">
        <div className="mb-sm flex items-center justify-between">
          <h2 className="flex items-center gap-1 text-sm font-semibold text-foreground">
            <MessageSquare className="size-4" /> Messages
          </h2>
          <Button asChild size="sm" variant="outline">
            <Link href="/teacher/messages">Open</Link>
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">Send a quick update to a parent, or review recent messages.</p>
      </div>

      <DetailDrawer open={aiOpen !== null} onOpenChange={(open) => !open && setAiOpen(null)} title="AI assistant" description="Draft content you can review and edit before sending">
        <div className="flex flex-col gap-sm">
          <div className="flex gap-1 rounded-md bg-surface-secondary p-1">
            {(["message", "summary", "revision"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => { setAiOpen(tab); setAiResult(""); }}
                className={`min-h-11 flex-1 rounded-md text-xs font-medium capitalize transition-colors sm:min-h-8 ${aiOpen === tab ? "bg-surface shadow-card text-foreground" : "text-muted-foreground"}`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div>
            <Label htmlFor="ai-input">{aiOpen === "message" ? "What's this about?" : aiOpen === "summary" ? "Section name" : "Topic"}</Label>
            <Input id="ai-input" value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} placeholder={aiOpen === "message" ? "e.g. missed homework this week" : aiOpen === "summary" ? "e.g. Class 6 A" : "e.g. Fractions"} />
          </div>
          <Button
            variant="outline"
            className="self-start"
            onClick={() => {
              if (aiOpen === "message") setAiResult(draftParentMessage("your child", "general", aiTopic || "a quick update on recent progress"));
              if (aiOpen === "summary") setAiResult(summarizeClassPerformance(aiTopic || "the class", 72, myAlerts.length));
              if (aiOpen === "revision") setAiResult(generateRevisionActivity("the subject", aiTopic || "the current topic"));
            }}
          >
            <Wand2 className="size-3.5" />
            Generate
          </Button>
          {aiResult && <Textarea value={aiResult} onChange={(e) => setAiResult(e.target.value)} rows={6} />}
        </div>
      </DetailDrawer>
    </div>
  );
}
