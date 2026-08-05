import type { Db } from "@/lib/data/store";
import { periodDefinitions, weekDays } from "@/lib/types/timetable";
import type { WeekDay } from "@/lib/types/timetable";

export type TeacherDayItem = {
  id: string;
  kind: "class" | "break" | "homework-due" | "lesson-plan-pending" | "event";
  title: string;
  detail?: string;
  startTime?: string;
  endTime?: string;
  status: "past" | "current" | "upcoming";
  href?: string;
};

function todayWeekDay(): WeekDay | null {
  const idx = new Date().getDay() - 1;
  return idx >= 0 && idx < 6 ? weekDays[idx] : null;
}

export function buildTeacherDay(db: Db, teacherId: string): TeacherDayItem[] {
  const day = todayWeekDay();
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const items: TeacherDayItem[] = [];

  if (day) {
    for (const timetable of db.timetables) {
      for (const slot of timetable.slots) {
        if (slot.day !== day || slot.teacherId !== teacherId) continue;
        const period = periodDefinitions.find((p) => p.index === slot.periodIndex);
        if (!period) continue;
        const [startH, startM] = period.startTime.split(":").map(Number);
        const [endH, endM] = period.endTime.split(":").map(Number);
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;
        const subject = db.subjects.find((s) => s.id === slot.subjectId);
        items.push({
          id: `class-${timetable.id}-${slot.id}`,
          kind: "class",
          title: subject ? `${subject.name} — ${timetable.sectionId}` : "Free period",
          detail: period.label,
          startTime: period.startTime,
          endTime: period.endTime,
          status: nowMinutes < startMinutes ? "upcoming" : nowMinutes < endMinutes ? "current" : "past",
          href: `/attendance/period?section=${timetable.sectionId}`,
        });
      }
    }
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  for (const hw of db.homework) {
    if (hw.teacherId !== teacherId) continue;
    if (hw.dueDate.slice(0, 10) === todayIso) {
      items.push({ id: `hw-${hw.id}`, kind: "homework-due", title: `Homework due: ${hw.title}`, status: "upcoming", href: `/academics/homework/${hw.id}` });
    }
  }

  for (const plan of db.lessonPlans) {
    if (plan.teacherId !== teacherId || plan.status !== "draft") continue;
    if (plan.date.slice(0, 10) === todayIso) {
      items.push({ id: `lp-${plan.id}`, kind: "lesson-plan-pending", title: "Lesson plan not yet submitted", status: "current", href: "/teacher/lesson-plans" });
    }
  }

  return items.sort((a, b) => (a.startTime ?? "99:99").localeCompare(b.startTime ?? "99:99"));
}

export function currentAndNextClass(items: TeacherDayItem[]): { current?: TeacherDayItem; next?: TeacherDayItem } {
  const classItems = items.filter((i) => i.kind === "class");
  return {
    current: classItems.find((i) => i.status === "current"),
    next: classItems.find((i) => i.status === "upcoming"),
  };
}
