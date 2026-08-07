import type { Db } from "@/lib/data/store";

export type ActivityPulseFactor = { key: string; label: string; score: number; displayValue: string; tone: "success" | "warning" | "error" };
export type ActivityPulse = { score: number; factors: ActivityPulseFactor[] };

function toneFor(score: number): "success" | "warning" | "error" {
  if (score >= 80) return "success";
  if (score >= 60) return "warning";
  return "error";
}

const TODAY = () => new Date().toISOString().slice(0, 10);

/** Campus Activity Pulse — an OPERATIONAL, AGGREGATE score (0-100) of how the
 * activities programme is running. It measures participation breadth, event
 * readiness and completion — NEVER an individual student's personality, worth,
 * talent or ranking. There is no per-student scoring anywhere in this function. */
export function computeActivityPulse(db: Db): ActivityPulse {
  const today = TODAY();
  const totalStudents = db.students.length || 1;

  // Participation breadth — share of students engaged in at least one activity
  // (event registration, club or sports team). Aggregate headcount only.
  const engaged = new Set<string>();
  db.eventRegistrations.forEach((r) => { if (r.status === "confirmed") engaged.add(r.studentId); });
  db.clubMemberships.forEach((m) => { if (m.status === "active") engaged.add(m.studentId); });
  db.teamMembers.forEach((tm) => engaged.add(tm.studentId));
  const breadthScore = Math.min(100, Math.round((engaged.size / totalStudents) * 100));

  // Event pipeline health — share of non-cancelled events actively progressing
  // (not stuck in idea) vs. total planned.
  const activeEvents = db.schoolEvents.filter((e) => e.stage !== "cancelled" && e.stage !== "archived");
  const progressing = activeEvents.filter((e) => e.stage !== "idea").length;
  const pipelineScore = activeEvents.length > 0 ? Math.round((progressing / activeEvents.length) * 100) : 100;

  // Planning readiness — share of event tasks completed across in-flight events.
  const inFlightTaskIds = new Set(db.schoolEvents.filter((e) => ["planning", "approved", "promotion", "live"].includes(e.stage)).map((e) => e.id));
  const relevantTasks = db.eventTasks.filter((t) => inFlightTaskIds.has(t.eventId));
  const doneTasks = relevantTasks.filter((t) => t.status === "done").length;
  const readinessScore = relevantTasks.length > 0 ? Math.round((doneTasks / relevantTasks.length) * 100) : 100;
  const blockedTasks = relevantTasks.filter((t) => t.status === "blocked").length;

  // Attendance conversion — for past events, share of confirmed registrants who
  // actually attended (aggregate turnout, not per-student behaviour).
  const pastEventIds = new Set(db.schoolEvents.filter((e) => e.stage === "completed").map((e) => e.id));
  const pastAttendance = db.eventAttendance.filter((a) => pastEventIds.has(a.eventId));
  const attended = pastAttendance.filter((a) => a.present).length;
  const turnoutScore = pastAttendance.length > 0 ? Math.round((attended / pastAttendance.length) * 100) : 100;

  // Club activity — share of clubs that are active/recruiting (not paused).
  const liveClubs = db.clubs.filter((c) => c.status === "active" || c.status === "recruiting").length;
  const clubScore = db.clubs.length > 0 ? Math.round((liveClubs / db.clubs.length) * 100) : 100;

  // Sports fixtures currency — share of scheduled fixtures that are not overdue
  // (a scheduled fixture whose date has passed but has no result is a backlog).
  const overdueFixtures = db.fixtures.filter((f) => f.status === "scheduled" && f.date < today).length;
  const fixtureScore = Math.max(0, 100 - overdueFixtures * 10);

  // Recognition throughput — competitions with results published vs. concluded.
  const concludedComps = db.competitions.filter((c) => c.status !== "open");
  const published = db.competitions.filter((c) => c.status === "results-published" || c.status === "closed").length;
  const recognitionScore = concludedComps.length > 0 ? Math.round((published / concludedComps.length) * 100) : 100;

  const factors: ActivityPulseFactor[] = [
    { key: "breadth", label: "Participation breadth", score: breadthScore, displayValue: `${engaged.size}/${totalStudents} engaged`, tone: toneFor(breadthScore) },
    { key: "pipeline", label: "Event pipeline", score: pipelineScore, displayValue: `${progressing}/${activeEvents.length} progressing`, tone: toneFor(pipelineScore) },
    { key: "readiness", label: "Planning readiness", score: readinessScore, displayValue: `${doneTasks}/${relevantTasks.length} tasks done`, tone: toneFor(readinessScore) },
    { key: "turnout", label: "Event turnout", score: turnoutScore, displayValue: `${turnoutScore}% attended`, tone: toneFor(turnoutScore) },
    { key: "clubs", label: "Club activity", score: clubScore, displayValue: `${liveClubs}/${db.clubs.length} active`, tone: toneFor(clubScore) },
    { key: "fixtures", label: "Fixture currency", score: fixtureScore, displayValue: `${overdueFixtures} overdue`, tone: toneFor(fixtureScore) },
    { key: "recognition", label: "Results throughput", score: recognitionScore, displayValue: `${published}/${concludedComps.length} published`, tone: toneFor(recognitionScore) },
    { key: "blocked", label: "Unblocked planning", score: Math.max(0, 100 - blockedTasks * 15), displayValue: `${blockedTasks} blocked`, tone: toneFor(Math.max(0, 100 - blockedTasks * 15)) },
  ];

  const score = Math.max(0, Math.min(100, Math.round(factors.reduce((sum, f) => sum + f.score, 0) / factors.length)));
  return { score, factors };
}
