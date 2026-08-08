// ---------------------------------------------------------------------------
// Date/time rules (see docs/backend-architecture.md §Timezone):
//   - Persist all instants as UTC DateTime (Postgres timestamptz).
//   - Store each school/branch's IANA timezone (School.timezone / Branch.timezone,
//     falling back to Tenant.timezone) and convert for DISPLAY at the edge.
//   - Never persist a formatted date string as a domain date.
//   - Academic date-only values (session start/end, DOB) use @db.Date and are
//     handled as calendar dates, independent of timezone.
// This module holds the small, dependency-free helpers the foundation needs;
// richer formatting belongs at the UI layer.
// ---------------------------------------------------------------------------

/** Parse a YYYY-MM-DD calendar date into a UTC-midnight Date for @db.Date columns. */
export function parseCalendarDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error(`Invalid calendar date: ${value}`);
  const [, y, m, d] = match;
  return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
}

/** Format a Date's calendar day as YYYY-MM-DD (UTC), for @db.Date round-tripping. */
export function formatCalendarDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Resolve the effective timezone for display: branch → school → tenant → default. */
export function effectiveTimezone(opts: { branch?: string | null; school?: string | null; tenant?: string | null }): string {
  return opts.branch || opts.school || opts.tenant || "Asia/Kolkata";
}
