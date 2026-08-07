"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Files, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { documentStatusLabels, documentStatusTone, documentTypeLabels, type DocumentStatus } from "@/lib/types/documents";
import { formatDate } from "@/lib/utils";

const statuses: (DocumentStatus | "all")[] = ["all", "generated", "issued", "printed", "draft", "revoked", "replaced", "expired"];

export default function DocumentHistoryPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<DocumentStatus | "all">("all");
  const [type, setType] = useState("all");

  const types = useMemo(() => Array.from(new Set(db.generatedDocuments.map((d) => d.type))), [db.generatedDocuments]);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...db.generatedDocuments]
      .filter((d) => (status === "all" ? true : d.status === status))
      .filter((d) => (type === "all" ? true : d.type === type))
      .filter((d) => (q ? d.number.toLowerCase().includes(q) || d.recipient.name.toLowerCase().includes(q) : true))
      .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
  }, [db.generatedDocuments, query, status, type]);

  if (!can("documents.view")) return <PermissionDenied action="view document history" role={roleLabels[role]} backHref="/documents" />;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><Files className="size-5 text-primary" /> Document history</h1><p className="text-xs text-muted-foreground">{rows.length} of {db.generatedDocuments.length} documents</p></div>

      <div className="flex flex-col gap-sm sm:flex-row sm:items-center">
        <div className="relative flex-1"><Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by number or recipient…" aria-label="Search documents" className="w-full rounded-md border border-border bg-surface py-1.5 pl-8 pr-3 text-sm text-foreground outline-none focus:border-primary" /></div>
        <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Type filter" className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-foreground"><option value="all">All types</option>{types.map((t) => <option key={t} value={t}>{documentTypeLabels[t]}</option>)}</select>
      </div>
      <div className="flex flex-wrap gap-1">
        {statuses.map((s) => <button key={s} type="button" onClick={() => setStatus(s)} className={`rounded-pill px-2.5 py-1 text-xs font-medium transition ${status === s ? "bg-primary text-primary-foreground" : "bg-surface-secondary text-muted-foreground hover:text-foreground"}`}>{s === "all" ? "All" : documentStatusLabels[s]}</button>)}
      </div>

      {/* Desktop table / mobile cards */}
      <div className="hidden overflow-x-auto rounded-lg border border-border sm:block">
        <table className="w-full min-w-max text-sm">
          <thead><tr className="border-b border-border bg-surface-secondary/40 text-left text-xs text-muted-foreground"><th className="px-sm py-2">Number</th><th className="px-sm py-2">Recipient</th><th className="px-sm py-2">Type</th><th className="px-sm py-2">Generated</th><th className="px-sm py-2">V</th><th className="px-sm py-2">Prints</th><th className="px-sm py-2">Checks</th><th className="px-sm py-2">Status</th></tr></thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id} className="border-b border-border/60 hover:bg-surface-secondary/30">
                <td className="px-sm py-2"><Link href={`/documents/history/${d.id}`} className="font-medium text-primary">{d.number}</Link></td>
                <td className="px-sm py-2 text-foreground">{d.recipient.name}</td>
                <td className="px-sm py-2 text-muted-foreground">{documentTypeLabels[d.type]}</td>
                <td className="px-sm py-2 text-muted-foreground">{formatDate(d.generatedAt.slice(0, 10))}</td>
                <td className="px-sm py-2 tabular-nums text-muted-foreground">v{d.version}</td>
                <td className="px-sm py-2 tabular-nums text-muted-foreground">{d.printCount}</td>
                <td className="px-sm py-2 tabular-nums text-muted-foreground">{d.verifyCount}</td>
                <td className="px-sm py-2"><Badge tone={documentStatusTone[d.status]}>{documentStatusLabels[d.status]}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-xs sm:hidden">
        {rows.map((d) => (
          <Link key={d.id} href={`/documents/history/${d.id}`} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm text-sm">
            <div className="min-w-0"><p className="truncate font-medium text-foreground">{d.recipient.name}</p><p className="truncate text-xs text-muted-foreground">{d.number} · {documentTypeLabels[d.type]}</p></div>
            <Badge tone={documentStatusTone[d.status]}>{documentStatusLabels[d.status]}</Badge>
          </Link>
        ))}
      </div>
      {rows.length === 0 && <div className="rounded-lg border border-dashed border-border p-2xl text-center text-sm text-muted-foreground">No documents match your filters.</div>}
    </div>
  );
}
