"use client";

// Document history (Phase 9V) — real PostgreSQL/API cutover.
import Link from "next/link";
import { useState } from "react";
import { Files, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useGeneratedDocuments } from "@/lib/hooks/api/use-document-studio-api";
import { roleLabels } from "@/lib/permissions/roles";
import { formatDateTime } from "@/lib/utils";

const statusTone = { generated: "success", void: "error" } as const;

export default function DocumentHistoryPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "generated" | "void">("all");
  const { data: rows } = useGeneratedDocuments({ q: query || undefined, status: status === "all" ? undefined : status });

  if (!capabilitiesLoading && !hasServerPermission("documents.view")) return <PermissionDenied action="view document history" role={roleLabels[role]} backHref="/documents" />;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><Files className="size-5 text-primary" /> Document history</h1><p className="text-xs text-muted-foreground">{rows.length} documents</p></div>

      <div className="flex flex-col gap-sm sm:flex-row sm:items-center">
        <div className="relative flex-1"><Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by number…" aria-label="Search documents" className="w-full rounded-md border border-border bg-surface py-1.5 pl-8 pr-3 text-sm text-foreground outline-none focus:border-primary" /></div>
      </div>
      <div className="flex flex-wrap gap-1">
        {(["all", "generated", "void"] as const).map((s) => <button key={s} type="button" onClick={() => setStatus(s)} className={`rounded-pill px-2.5 py-1 text-xs font-medium capitalize transition ${status === s ? "bg-primary text-primary-foreground" : "bg-surface-secondary text-muted-foreground hover:text-foreground"}`}>{s}</button>)}
      </div>

      <div className="hidden overflow-x-auto rounded-lg border border-border sm:block">
        <table className="w-full min-w-max text-sm">
          <thead><tr className="border-b border-border bg-surface-secondary/40 text-left text-xs text-muted-foreground"><th className="px-sm py-2">Number</th><th className="px-sm py-2">Recipient</th><th className="px-sm py-2">Type</th><th className="px-sm py-2">Generated</th><th className="px-sm py-2">By</th><th className="px-sm py-2">Status</th></tr></thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id} className="border-b border-border/60 hover:bg-surface-secondary/30">
                <td className="px-sm py-2"><Link href={`/documents/history/${d.id}`} className="font-medium text-primary">{d.documentNumber}</Link></td>
                <td className="px-sm py-2 text-foreground">{d.recipientName}</td>
                <td className="px-sm py-2 text-muted-foreground">{d.docType}</td>
                <td className="px-sm py-2 text-muted-foreground">{formatDateTime(d.generatedAt)}</td>
                <td className="px-sm py-2 text-muted-foreground">{d.generatedByName}</td>
                <td className="px-sm py-2"><Badge tone={statusTone[d.status]}>{d.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-xs sm:hidden">
        {rows.map((d) => (
          <Link key={d.id} href={`/documents/history/${d.id}`} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm text-sm">
            <div className="min-w-0"><p className="truncate font-medium text-foreground">{d.recipientName}</p><p className="truncate text-xs text-muted-foreground">{d.documentNumber} · {d.docType}</p></div>
            <Badge tone={statusTone[d.status]}>{d.status}</Badge>
          </Link>
        ))}
      </div>
      {rows.length === 0 && <div className="rounded-lg border border-dashed border-border p-2xl text-center text-sm text-muted-foreground">No documents match your filters.</div>}
    </div>
  );
}
