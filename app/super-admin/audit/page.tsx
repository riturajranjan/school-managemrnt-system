"use client";

import { useMemo, useState } from "react";
import { Search, TicketCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { usePlatformAudit } from "@/lib/hooks/use-saas";
import { formatDateTime } from "@/lib/utils";

export default function PlatformAuditPage() {
  const log = usePlatformAudit();
  const [query, setQuery] = useState("");
  const rows = useMemo(() => { const q = query.trim().toLowerCase(); return q ? log.filter((e) => e.admin.toLowerCase().includes(q) || e.action.toLowerCase().includes(q) || e.tenantName.toLowerCase().includes(q)) : log; }, [log, query]);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><TicketCheck className="size-5 text-primary" /> Platform audit log</h1><p className="text-xs text-muted-foreground">{log.length} entries · no real audit backend</p></div>
      <div className="relative max-w-sm"><Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search audit…" aria-label="Search audit" className="w-full rounded-md border border-border bg-surface py-1.5 pl-8 pr-3 text-sm text-foreground outline-none focus:border-primary" /></div>

      <div className="hidden overflow-x-auto rounded-lg border border-border sm:block">
        <table className="w-full min-w-max text-sm">
          <thead><tr className="border-b border-border bg-surface-secondary/60 text-left text-xs text-muted-foreground"><th className="px-sm py-2">Admin</th><th className="px-sm py-2">Action</th><th className="px-sm py-2">School</th><th className="px-sm py-2">Module</th><th className="px-sm py-2">Timestamp</th><th className="px-sm py-2">Result</th></tr></thead>
          <tbody>
            {rows.map((e) => <tr key={e.id} className="border-b border-border/60"><td className="px-sm py-2 text-foreground">{e.admin}</td><td className="px-sm py-2 text-foreground">{e.action}</td><td className="px-sm py-2 text-muted-foreground">{e.tenantName}</td><td className="px-sm py-2 text-muted-foreground">{e.module}</td><td className="px-sm py-2 text-muted-foreground">{formatDateTime(e.timestamp)}</td><td className="px-sm py-2"><Badge tone={e.result === "success" ? "success" : "error"}>{e.result}</Badge></td></tr>)}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-xs sm:hidden">
        {rows.map((e) => <div key={e.id} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm text-sm"><div className="min-w-0"><p className="truncate font-medium text-foreground">{e.action}</p><p className="truncate text-xs text-muted-foreground">{e.admin} · {e.tenantName} · {formatDateTime(e.timestamp)}</p></div><Badge tone={e.result === "success" ? "success" : "error"}>{e.result}</Badge></div>)}
      </div>
    </div>
  );
}
