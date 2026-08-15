// Academic Calendar (Phase 9D.1) — real, PostgreSQL-backed. listCalendarEvents
// returns a MERGED view: real manual CalendarEvent rows + events DERIVED live
// from Exam schedule entries / Homework due dates / Lesson Plan planned dates.
// Derived occurrences are computed on every read from their own real tables —
// never copied into CalendarEvent — so there is exactly one truth for e.g. a
// Homework due date and the calendar can never drift from it (see the schema
// doc comment on CalendarEvent). Manual events may recur weekly/yearly,
// expanded into concrete occurrence dates within the requested range.
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { createNotification } from "@/lib/server/notifications/service";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { CalendarEventDto, CalendarEventTypeDto } from "@/lib/api/contracts";

function requireSession(scope: OrgScope): string {
  if (!scope.academicSessionId) throw new HttpError("INVALID_SESSION", "Select an academic session first");
  return scope.academicSessionId;
}

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");
const parseDate = (d: string) => new Date(`${d}T00:00:00.000Z`);
const dateToUi = (d: Date) => d.toISOString().slice(0, 10);
const startOfLocalDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

const TYPE_TO_DB: Record<CalendarEventTypeDto, string> = { holiday: "HOLIDAY", meeting: "MEETING", ptm: "PTM", celebration: "CELEBRATION", activity: "ACTIVITY", deadline: "DEADLINE", other: "OTHER" };
const DB_TO_TYPE: Record<string, CalendarEventTypeDto> = { HOLIDAY: "holiday", MEETING: "meeting", PTM: "ptm", CELEBRATION: "celebration", ACTIVITY: "activity", DEADLINE: "deadline", OTHER: "other" };
const typeToUi = (t: string): CalendarEventTypeDto => DB_TO_TYPE[t] ?? "other";
const AUDIENCE_TO_DB: Record<string, string> = { all: "ALL_STAFF", teachers: "TEACHERS" };
const audienceToUi = (a: string): "all" | "teachers" => (a === "TEACHERS" ? "teachers" : "all");
const RECURRENCE_TO_DB: Record<string, string> = { none: "NONE", weekly: "WEEKLY", yearly: "YEARLY" };
const recurrenceToUi = (r: string): "none" | "weekly" | "yearly" => (r === "WEEKLY" ? "weekly" : r === "YEARLY" ? "yearly" : "none");

async function isBroadCalendarManager(scope: OrgScope): Promise<boolean> {
  const m = await prisma.roleAssignment.findFirst({
    where: { membership: { userId: scope.actor.id, tenantId: scope.tenantId, status: "ACTIVE" }, role: { key: { in: ["SCHOOL_ADMIN", "PRINCIPAL"] } } },
    select: { id: true },
  });
  return Boolean(m);
}

// ── Read: merged real + derived occurrences ─────────────────────────────────

export const listCalendarSchema = z.object({ from: dateStr, to: dateStr });

/** Expand a manual event's recurrence into occurrence dates within [start, end] (both inclusive, UTC-day). Capped at 400 iterations — a malformed recurrence can never hang the query. */
function expand(startDate: Date, recurrence: string, start: Date, end: Date): Date[] {
  if (recurrence === "NONE") return startDate >= start && startDate <= end ? [startDate] : [];
  const out: Date[] = [];
  if (recurrence === "WEEKLY") {
    let cursor = new Date(startDate);
    let guard = 0;
    while (cursor <= end && guard < 400) {
      if (cursor >= start) out.push(new Date(cursor));
      cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate() + 7));
      guard += 1;
    }
  } else if (recurrence === "YEARLY") {
    for (let year = startDate.getUTCFullYear(); year <= end.getUTCFullYear(); year++) {
      const occ = new Date(Date.UTC(year, startDate.getUTCMonth(), startDate.getUTCDate()));
      if (occ >= start && occ <= end && occ >= startDate) out.push(occ);
    }
  }
  return out;
}

export async function listCalendarEvents(scope: OrgScope, raw: unknown): Promise<CalendarEventDto[]> {
  const input = parseInput(listCalendarSchema, raw);
  const sessionId = requireSession(scope);
  const start = startOfLocalDay(parseDate(input.from));
  const end = startOfLocalDay(parseDate(input.to));
  if (start > end) throw new HttpError("VALIDATION_ERROR", "`from` must not be after `to`");

  const [manual, examEntries, homeworkRows, lessonPlanRows] = await Promise.all([
    prisma.calendarEvent.findMany({
      where: { schoolId: scope.schoolId, academicSessionId: sessionId, status: "ACTIVE", ...(scope.branchId ? { OR: [{ branchId: null }, { branchId: scope.branchId }] } : {}) },
      select: { id: true, title: true, description: true, eventType: true, audience: true, startDate: true, endDate: true, allDay: true, recurrence: true, recurrenceUntil: true, location: true, createdByName: true },
    }),
    prisma.examScheduleEntry.findMany({
      where: { schoolId: scope.schoolId, academicSessionId: sessionId, examDate: { gte: start, lte: end } },
      select: { id: true, examDate: true, subject: { select: { name: true } }, exam: { select: { name: true } } },
    }),
    prisma.homework.findMany({
      where: { schoolId: scope.schoolId, academicSessionId: sessionId, status: "PUBLISHED", dueAt: { gte: start, lte: end } },
      select: { id: true, title: true, dueAt: true },
    }),
    prisma.lessonPlan.findMany({
      where: { schoolId: scope.schoolId, academicSessionId: sessionId, status: { in: ["APPROVED", "COMPLETED"] }, plannedDate: { gte: start, lte: end } },
      select: { id: true, title: true, plannedDate: true, subject: { select: { name: true } } },
    }),
  ]);

  const out: CalendarEventDto[] = [];

  // ALL_STAFF/TEACHERS are both staff-only (no parent/student login yet — see
  // the CalendarEvent schema doc comment), so every actor reaching this
  // function is staff; no further audience narrowing is needed beyond
  // returning the DB row's own audience for client-side display/filtering.
  for (const m of manual) {
    const occurrences = expand(startOfLocalDay(m.startDate), m.recurrence, start, end);
    for (const occ of occurrences) {
      out.push({
        id: `manual:${m.id}:${dateToUi(occ)}`, sourceType: "manual", sourceId: m.id,
        title: m.title, description: m.description, type: typeToUi(m.eventType), audience: audienceToUi(m.audience),
        startDate: dateToUi(occ), endDate: m.endDate ? dateToUi(m.endDate) : null, allDay: m.allDay,
        recurring: recurrenceToUi(m.recurrence), location: m.location, createdBy: m.createdByName, editable: true,
      });
    }
  }
  for (const e of examEntries) {
    out.push({
      id: `exam:${e.id}`, sourceType: "exam", sourceId: e.id,
      title: `${e.exam.name} — ${e.subject.name}`, description: null, type: "deadline", audience: "all",
      startDate: dateToUi(e.examDate), endDate: null, allDay: true, recurring: "none", location: null, createdBy: null, editable: false,
    });
  }
  for (const h of homeworkRows) {
    out.push({
      id: `homework:${h.id}`, sourceType: "homework", sourceId: h.id,
      title: `Homework due — ${h.title}`, description: null, type: "deadline", audience: "all",
      startDate: dateToUi(h.dueAt), endDate: null, allDay: true, recurring: "none", location: null, createdBy: null, editable: false,
    });
  }
  for (const l of lessonPlanRows) {
    out.push({
      id: `lesson-plan:${l.id}`, sourceType: "lesson-plan", sourceId: l.id,
      title: `${l.subject.name} — ${l.title}`, description: null, type: "activity", audience: "teachers",
      startDate: dateToUi(l.plannedDate), endDate: null, allDay: true, recurring: "none", location: null, createdBy: null, editable: false,
    });
  }

  return out.sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0));
}

// ── Recipient resolution for CALENDAR_EVENT notifications ──────────────────

async function resolveAudienceUserIds(scope: OrgScope, audience: string): Promise<string[]> {
  const rows = await prisma.staff.findMany({
    where: { schoolId: scope.schoolId, status: "ACTIVE", userId: { not: null }, ...(audience === "TEACHERS" ? { isTeaching: true } : {}) },
    select: { userId: true },
  });
  return rows.map((r) => r.userId).filter((id): id is string => Boolean(id));
}

// ── Mutations (broad-manager only) ──────────────────────────────────────────

export const createCalendarEventSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional(),
  type: z.enum(["holiday", "meeting", "ptm", "celebration", "activity", "deadline", "other"]),
  audience: z.enum(["all", "teachers"]).default("all"),
  startDate: dateStr,
  endDate: dateStr.optional(),
  allDay: z.boolean().default(true),
  recurring: z.enum(["none", "weekly", "yearly"]).default("none"),
  recurrenceUntil: dateStr.optional(),
  location: z.string().trim().max(200).optional(),
});

export async function createCalendarEvent(scope: OrgScope, raw: unknown) {
  if (!(await isBroadCalendarManager(scope))) throw new HttpError("FORBIDDEN", "You do not have permission to perform this action.");
  const input = parseInput(createCalendarEventSchema, raw);
  const sessionId = requireSession(scope);
  const audienceDb = AUDIENCE_TO_DB[input.audience];

  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.calendarEvent.create({
      data: {
        tenantId: scope.tenantId, schoolId: scope.schoolId, branchId: scope.branchId, academicSessionId: sessionId,
        title: input.title, description: input.description ?? null, eventType: TYPE_TO_DB[input.type] as never, audience: audienceDb as never,
        startDate: parseDate(input.startDate), endDate: input.endDate ? parseDate(input.endDate) : null, allDay: input.allDay,
        recurrence: RECURRENCE_TO_DB[input.recurring] as never, recurrenceUntil: input.recurrenceUntil ? parseDate(input.recurrenceUntil) : null,
        location: input.location ?? null, createdByUserId: scope.actor.id, createdByName: scope.actor.name,
      },
      select: { id: true, title: true, startDate: true },
    });
    await recordAudit(tx, scope, "CALENDAR_EVENT_CREATED", "CalendarEvent", row.id, { title: input.title, startDate: input.startDate });

    const recipientUserIds = await resolveAudienceUserIds(scope, audienceDb);
    await createNotification(tx, {
      tenantId: scope.tenantId, schoolId: scope.schoolId, type: "CALENDAR_EVENT",
      title: `New calendar event: ${row.title}`, body: `${row.title} on ${dateToUi(row.startDate)}`,
      href: "/academics/calendar", sourceType: "CalendarEvent", sourceId: row.id,
      dedupeKey: `CALENDAR_EVENT:${row.id}`, recipientUserIds,
    });
    return row;
  });
  return created.id;
}

export const updateCalendarEventSchema = createCalendarEventSchema.partial();

export async function updateCalendarEvent(scope: OrgScope, calendarEventId: string, raw: unknown): Promise<void> {
  if (!(await isBroadCalendarManager(scope))) throw new HttpError("FORBIDDEN", "You do not have permission to perform this action.");
  const input = parseInput(updateCalendarEventSchema, raw);
  const existing = await prisma.calendarEvent.findFirst({ where: { id: calendarEventId, schoolId: scope.schoolId, academicSessionId: requireSession(scope) }, select: { id: true } });
  if (!existing) throw new HttpError("CALENDAR_EVENT_NOT_FOUND", "Calendar event not found");

  await prisma.$transaction(async (tx) => {
    await tx.calendarEvent.update({
      where: { id: calendarEventId },
      data: {
        title: input.title, description: input.description === undefined ? undefined : input.description ?? null,
        eventType: (input.type ? TYPE_TO_DB[input.type] : undefined) as never, audience: (input.audience ? AUDIENCE_TO_DB[input.audience] : undefined) as never,
        startDate: input.startDate ? parseDate(input.startDate) : undefined, endDate: input.endDate === undefined ? undefined : input.endDate ? parseDate(input.endDate) : null,
        allDay: input.allDay, recurrence: (input.recurring ? RECURRENCE_TO_DB[input.recurring] : undefined) as never,
        recurrenceUntil: input.recurrenceUntil === undefined ? undefined : input.recurrenceUntil ? parseDate(input.recurrenceUntil) : null,
        location: input.location === undefined ? undefined : input.location ?? null,
      },
    });
    await recordAudit(tx, scope, "CALENDAR_EVENT_UPDATED", "CalendarEvent", calendarEventId);
  });
}

export async function cancelCalendarEvent(scope: OrgScope, calendarEventId: string): Promise<void> {
  if (!(await isBroadCalendarManager(scope))) throw new HttpError("FORBIDDEN", "You do not have permission to perform this action.");
  const existing = await prisma.calendarEvent.findFirst({ where: { id: calendarEventId, schoolId: scope.schoolId, academicSessionId: requireSession(scope) }, select: { id: true } });
  if (!existing) throw new HttpError("CALENDAR_EVENT_NOT_FOUND", "Calendar event not found");

  await prisma.$transaction(async (tx) => {
    await tx.calendarEvent.update({ where: { id: calendarEventId }, data: { status: "CANCELLED" } });
    await recordAudit(tx, scope, "CALENDAR_EVENT_CANCELLED", "CalendarEvent", calendarEventId);
  });
}
