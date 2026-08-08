"use client";

import { useMemo, useState } from "react";
import { ScrollText, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { usePlatformAudit } from "@/lib/hooks/use-saas";
import { formatDateTime } from "@/lib/utils";

export default function PlatformActivityPage() {
  const log = usePlatformAudit();
  const [query, setQuery] = useState("");
  const [module, setModule] = useState("all");
  const modules = useMemo(() => Array.from(new Set(log.map((e) => e.module))), [log]);
  const rows = useMemo(() => { const q = query.trim().toLowerCase(); return log.filter((e) => (module === "all" ? true : e.module === module)).filter((e) => (q ? e.action.toLowerCase().includes(q) || e.tenantName.toLowerCase().includes(q) || e.admin.toLowerCase().includes(q) : true)); }, [log, query, module]);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><ScrollText className="size-5 text-primary" /> Platform activity</h1><p className="text-xs text-muted-foreground">{log.length} events</p></div>
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center">
        <div className="relative flex-1"><Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search activity…" aria-label="Search activity" className="w-full rounded-md border border-border bg-surface py-1.5 pl-8 pr-3 text-sm text-foreground outline-none focus:border-primary" /></div>
        <select value={module} onChange={(e) => setModule(e.target.value)} aria-label="Module filter" className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-foreground"><option value="all">All modules</option>{modules.map((m) => <option key={m} value={m}>{m}</option>)}</select>
      </div>
      <div className="flex flex-col gap-xs">
        {rows.map((e) => (
          <div key={e.id} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm text-sm">
            <div className="min-w-0"><p className="truncate text-foreground"><span className="font-medium">{e.action}</span> · {e.tenantName}</p><p className="truncate text-xs text-muted-foreground">{e.admin} · {e.module} · {formatDateTime(e.timestamp)}</p></div>
            <Badge tone={e.result === "success" ? "success" : "error"}>{e.result}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
