import type { AcademicEvent } from "@/lib/types/academics";

export type EventOccurrence = { event: AcademicEvent; date: string };

/** Local-calendar-day key (YYYY-MM-DD) — deliberately NOT `.toISOString()`, which
 * converts to UTC first and silently shifts the date by a day in any timezone ahead of
 * or behind UTC. Every date comparison in this module goes through this helper so
 * "today" always means the viewer's actual today. */
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function startOfLocalDay(dateStr: string): Date {
  const [y, m, d] = dateStr.slice(0, 10).split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Expands `weekly`/`yearly` recurring events into concrete occurrence dates within
 * [rangeStart, rangeEnd] (inclusive, both as YYYY-MM-DD). Non-recurring events yield at
 * most one occurrence if their startDate falls in range. Capped at 400 iterations per
 * event so a malformed recurrence can never hang the calendar render. */
export function expandOccurrences(events: AcademicEvent[], rangeStart: string, rangeEnd: string): EventOccurrence[] {
  const start = startOfLocalDay(rangeStart);
  const end = startOfLocalDay(rangeEnd);
  const occurrences: EventOccurrence[] = [];

  for (const event of events) {
    const eventStart = startOfLocalDay(event.startDate);
    if (Number.isNaN(eventStart.getTime())) continue;

    if (!event.recurring || event.recurring === "none") {
      if (eventStart >= start && eventStart <= end) occurrences.push({ event, date: dateKey(eventStart) });
      continue;
    }

    if (event.recurring === "weekly") {
      let cursor = new Date(eventStart);
      let guard = 0;
      while (cursor <= end && guard < 400) {
        if (cursor >= start) occurrences.push({ event, date: dateKey(cursor) });
        cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 7);
        guard += 1;
      }
    } else if (event.recurring === "yearly") {
      for (let year = eventStart.getFullYear(); year <= end.getFullYear(); year++) {
        const occurrence = new Date(year, eventStart.getMonth(), eventStart.getDate());
        if (occurrence >= start && occurrence <= end && occurrence >= eventStart) occurrences.push({ event, date: dateKey(occurrence) });
      }
    }
  }

  return occurrences.sort((a, b) => (a.date < b.date ? -1 : 1));
}
