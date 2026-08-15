"use client";

// My Day (Phase 9A/9B/9C.2) — real PostgreSQL/API cutover. Same layout/shell
// as before; every widget now reads from GET /api/my-day (real Staff.userId
// identity, real TimetableEntry/AttendanceSession/ExamMarkSheet/
// ExamScheduleEntry/Homework/LessonPlan) instead of the mock CURRENT_TEACHER_ID
// + teacher-day selector. The old "Student support alerts" section is removed
// outright: it read a mock store slice (studentSupportAlerts) with no real
// domain behind it and isn't part of this phase's scope, so there is nothing
// honest to show in its place.
import Link from "next/link";
import { useState } from "react";
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
import { useMyDay } from "@/lib/hooks/api/use-my-day-api";
import { draftParentMessage, generateRevisionActivity, summarizeClassPerformance } from "@/lib/services/teacher-ai-service";
import type { MyDayTimetableEntryDto } from "@/lib/api/contracts";
import { formatDate } from "@/lib/utils";

const ATTENDANCE_ACTION_LABEL: Record<MyDayTimetableEntryDto["attendance"]["status"], string> = {
  not_marked: "Not marked", draft: "Draft", submitted: "Submitted", locked: "Locked",
};

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export default function TeacherMyDayPage() {
  const { data: myDay, loading, error } = useMyDay();
  const [aiOpen, setAiOpen] = useState<null | "message" | "summary" | "revision">(null);
  const [aiTopic, setAiTopic] = useState("");
  const [aiResult, setAiResult] = useState("");

  if (loading) return <p className="py-2xl text-center text-sm text-muted-foreground">Loading…</p>;
  if (error || !myDay) return <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">{error ?? "Couldn't load My Day."}</p>;

  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const current = myDay.timetable.find((t) => nowMinutes >= toMinutes(t.period.startTime) && nowMinutes < toMinutes(t.period.endTime));
  const next = myDay.timetable.find((t) => toMinutes(t.period.startTime) > nowMinutes);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = myDay.staff?.name.split(" ")[0];

  return (
    <div className="flex flex-col gap-md pb-24 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">
          {greeting}{firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="text-xs text-muted-foreground">{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</p>
      </div>

      {!myDay.staff && (
        <div className="rounded-lg border border-dashed border-border bg-surface p-md text-center text-sm text-muted-foreground">
          My Day shows a teaching schedule — there&apos;s no teaching Staff profile linked to your account.
        </div>
      )}

      {myDay.staff && (
        <>
          <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
            <div className={`rounded-lg border p-sm ${current ? "border-primary bg-primary/5" : "border-border bg-surface"}`}>
              <p className="text-xs font-medium text-muted-foreground">Current class</p>
              {current ? (
                <>
                  <p className="text-sm font-semibold text-foreground">{current.subject.name} — {current.section.className}-{current.section.name}</p>
                  <p className="text-xs text-muted-foreground">{current.period.startTime} – {current.period.endTime}</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No class in session</p>
              )}
            </div>
            <div className="rounded-lg border border-border bg-surface p-sm">
              <p className="text-xs font-medium text-muted-foreground">Next class</p>
              {next ? (
                <>
                  <p className="text-sm font-semibold text-foreground">{next.subject.name} — {next.section.className}-{next.section.name}</p>
                  <p className="text-xs text-muted-foreground">{next.period.startTime} – {next.period.endTime}</p>
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
            <StatTile label="Classes today" value={String(myDay.timetable.length)} icon={ClipboardList} tone="info" />
            <StatTile label="Attendance pending" value={String(myDay.attendance.pendingCount)} icon={CalendarCheck} tone={myDay.attendance.pendingCount > 0 ? "warning" : "success"} />
            <StatTile label="Homework due/overdue" value={String(myDay.homework.dueTodayOrOverdueCount)} icon={BookOpenCheck} tone={myDay.homework.dueTodayOrOverdueCount > 0 ? "warning" : "success"} />
            <StatTile label="Lesson plan drafts" value={String(myDay.lessonPlans.draftCount)} icon={ClipboardList} tone={myDay.lessonPlans.draftCount > 0 ? "warning" : "success"} />
          </section>

          <div className="rounded-lg border border-border bg-surface p-md">
            <h2 className="mb-sm text-sm font-semibold text-foreground">Today&apos;s timeline</h2>
            {myDay.timetable.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing scheduled today.</p>
            ) : (
              <ol className="flex flex-col gap-1">
                {myDay.timetable.map((entry) => {
                  const isCurrent = current?.timetableEntryId === entry.timetableEntryId;
                  return (
                    <li key={entry.timetableEntryId}>
                      <Link
                        href="/attendance/period"
                        className={`flex items-center justify-between gap-sm rounded-md border p-sm text-sm ${isCurrent ? "border-primary bg-primary/5" : "border-border bg-surface hover:bg-surface-secondary/60"}`}
                      >
                        <span className="min-w-0 truncate text-foreground">
                          {entry.subject.name} — {entry.section.className}-{entry.section.name}
                        </span>
                        <span className="flex shrink-0 items-center gap-xs text-xs text-muted-foreground">
                          {entry.period.startTime}
                          <Badge tone={entry.attendance.status === "not_marked" ? "warning" : entry.attendance.status === "draft" ? "warning" : "success"}>
                            {ATTENDANCE_ACTION_LABEL[entry.attendance.status]}
                          </Badge>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          {myDay.marks.actions.length > 0 && (
            <div className="rounded-lg border border-border bg-surface p-md">
              <h2 className="mb-sm flex items-center gap-1 text-sm font-semibold text-foreground">
                <AlertTriangle className="size-4 text-warning" /> Marks pending
              </h2>
              <ul className="flex flex-col gap-sm">
                {myDay.marks.actions.map((m) => (
                  <li key={m.entryId} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{m.examName} · {m.subject.name}</p>
                      <p className="text-xs text-muted-foreground">{m.section.className}-{m.section.name} · {m.enteredCount}/{m.totalStudents} entered</p>
                    </div>
                    <Badge tone={m.sheetStatus === "submitted" ? "info" : "warning"}>{m.sheetStatus}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {myDay.upcomingExams.length > 0 && (
            <div className="rounded-lg border border-border bg-surface p-md">
              <h2 className="mb-sm text-sm font-semibold text-foreground">Upcoming exams</h2>
              <ul className="flex flex-col gap-1">
                {myDay.upcomingExams.map((e) => (
                  <li key={`${e.examId}-${e.subject?.id ?? "x"}`} className="flex items-center justify-between text-sm">
                    <span className="truncate text-foreground">{e.examName}{e.subject ? ` — ${e.subject.name}` : ""}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{e.examDate}</span>
                  </li>
                ))}
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
              {myDay.homework.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">No published homework due soon.</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {myDay.homework.items.map((h) => (
                    <li key={h.id} className="flex items-center justify-between text-sm">
                      <Link href={`/academics/homework/${h.id}`} className="truncate text-foreground hover:underline">
                        {h.title}
                      </Link>
                      <span className="shrink-0 text-xs text-muted-foreground">Due {formatDate(h.dueAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {myDay.homework.draftCount > 0 && <p className="mt-xs text-xs text-muted-foreground">{myDay.homework.draftCount} draft{myDay.homework.draftCount === 1 ? "" : "s"} not yet published.</p>}
            </div>

            <div className="rounded-lg border border-border bg-surface p-md">
              <div className="mb-sm flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">Lesson plans — today</h2>
                <Link href="/teacher/lesson-plans" className="text-xs font-medium text-primary hover:underline">
                  View all
                </Link>
              </div>
              {myDay.lessonPlans.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">No lesson plan for today yet.</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {myDay.lessonPlans.items.map((p) => (
                    <li key={p.id} className="flex items-center justify-between text-sm">
                      <Link href={`/teacher/lesson-plans?open=${p.id}`} className="truncate text-foreground hover:underline">
                        {p.section.className}-{p.section.name} · {p.subject.name}
                      </Link>
                      <span className="shrink-0 text-xs text-muted-foreground">{p.status}</span>
                    </li>
                  ))}
                </ul>
              )}
              {myDay.lessonPlans.draftCount > 0 && <p className="mt-xs text-xs text-muted-foreground">{myDay.lessonPlans.draftCount} draft{myDay.lessonPlans.draftCount === 1 ? "" : "s"} not yet submitted.</p>}
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
        </>
      )}

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
              if (aiOpen === "summary") setAiResult(summarizeClassPerformance(aiTopic || "the class", 72, 0));
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
