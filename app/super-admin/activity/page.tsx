"use client";

// Real platform activity (Super Admin SA-4N). A presentation over the SAME real
// AuditEvent read API as the Audit Log (GET /api/super-admin/audit) — no second
// event store, no mock. Server-filtered + paginated.
import { useState } from "react";
import { ScrollText, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuditEvents } from "@/lib/hooks/api/use-platform-system";
import { formatDateTime } from "@/lib/utils";

export default function PlatformActivityPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { data, meta, loading, error } = useAuditEvents({ page, pageSize: 25, search: search.trim() || undefined });

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><ScrollText className="size-5 text-primary" /> Platform activity</h1><p className="text-xs text-muted-foreground">{meta?.total ?? 0} events · real AuditEvent stream</p></div>
      <div className="relative max-w-sm"><Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search activity…" aria-label="Search activity" className="w-full rounded-md border border-border bg-surface py-1.5 pl-8 pr-3 text-sm text-foreground outline-none focus:border-primary" /></div>

      {loading && <div className="py-2xl text-center text-sm text-muted-foreground">Loading activity…</div>}
      {error && !loading && <div className="rounded-lg border border-dashed border-error/40 p-md text-center text-sm text-error">Could not load activity: {error}</div>}

      {!loading && !error && (
        <>
          <div className="flex flex-col gap-xs">
            {data.length === 0 && <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No activity.</p>}
            {data.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm text-sm">
                <div className="min-w-0"><p className="truncate text-foreground"><span className="font-medium">{e.action}</span> · {e.entityType}</p><p className="truncate text-xs text-muted-foreground">{e.actor.name ?? e.actor.userId ?? "system"} · {formatDateTime(e.createdAt)}</p></div>
                {e.schoolId && <Badge tone="neutral">school</Badge>}
              </div>
            ))}
          </div>
          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-xs text-muted-foreground">Page {meta.page} of {meta.totalPages}</span>
              <div className="flex gap-xs">
                <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-md border border-border px-2 py-1 text-xs disabled:opacity-50">Prev</button>
                <button type="button" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-md border border-border px-2 py-1 text-xs disabled:opacity-50">Next</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
