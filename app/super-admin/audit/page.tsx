"use client";

// Real platform audit log (Super Admin SA-4N). Read-only, server-filtered view
// over the real AuditEvent table (GET /api/super-admin/audit) — no mock store,
// no client-side full-log load. Audit is evidence: never edited/deleted here.
import { useState } from "react";
import { Search, TicketCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuditEvents } from "@/lib/hooks/api/use-platform-system";
import { formatDateTime } from "@/lib/utils";

export default function PlatformAuditPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { data, meta, loading, error } = useAuditEvents({ page, pageSize: 25, search: search.trim() || undefined });

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><TicketCheck className="size-5 text-primary" /> Platform audit log</h1><p className="text-xs text-muted-foreground">{meta?.total ?? 0} entries · real AuditEvent records (read-only)</p></div>
      <div className="relative max-w-sm"><Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search action / actor / entity…" aria-label="Search audit" className="w-full rounded-md border border-border bg-surface py-1.5 pl-8 pr-3 text-sm text-foreground outline-none focus:border-primary" /></div>

      {loading && <div className="py-2xl text-center text-sm text-muted-foreground">Loading audit…</div>}
      {error && !loading && <div className="rounded-lg border border-dashed border-error/40 p-md text-center text-sm text-error">Could not load audit: {error}</div>}

      {!loading && !error && (
        <>
          <div className="hidden overflow-x-auto rounded-lg border border-border sm:block">
            <table className="w-full min-w-max text-sm">
              <thead><tr className="border-b border-border bg-surface-secondary/60 text-left text-xs text-muted-foreground"><th className="px-sm py-2">Actor</th><th className="px-sm py-2">Action</th><th className="px-sm py-2">Entity</th><th className="px-sm py-2">School</th><th className="px-sm py-2">Timestamp</th></tr></thead>
              <tbody>
                {data.map((e) => <tr key={e.id} className="border-b border-border/60"><td className="px-sm py-2 text-foreground">{e.actor.name ?? e.actor.userId ?? "system"}</td><td className="px-sm py-2"><Badge tone="neutral">{e.action}</Badge></td><td className="px-sm py-2 text-muted-foreground">{e.entityType}</td><td className="px-sm py-2 text-muted-foreground">{e.schoolId ?? "—"}</td><td className="px-sm py-2 text-muted-foreground">{formatDateTime(e.createdAt)}</td></tr>)}
                {data.length === 0 && <tr><td colSpan={5} className="px-sm py-lg text-center text-muted-foreground">No audit entries.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-xs sm:hidden">
            {data.map((e) => <div key={e.id} className="rounded-lg border border-border bg-surface p-sm text-sm"><p className="truncate font-medium text-foreground">{e.action}</p><p className="truncate text-xs text-muted-foreground">{e.actor.name ?? "system"} · {e.entityType} · {formatDateTime(e.createdAt)}</p></div>)}
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
