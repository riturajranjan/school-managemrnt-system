"use client";

// Document Studio hub (Phase 9V) — real PostgreSQL/API cutover. The mock's
// "Document Flow" pipeline visual, print queue, and batch generation are
// dropped — no real print-queue/batch-generation infrastructure exists in
// this phase (see the final report's DEFERRED section).
import Link from "next/link";
import { useState } from "react";
import { BadgeCheck, Files, IdCard, LayoutTemplate, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useDocumentStudioDashboard, useGeneratedDocuments } from "@/lib/hooks/api/use-document-studio-api";
import { roleLabels } from "@/lib/permissions/roles";
import { formatDateTime } from "@/lib/utils";

const statusTone = { generated: "success", void: "error" } as const;

export default function DocumentStudioPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const [query, setQuery] = useState("");
  const { data: dashboard } = useDocumentStudioDashboard();
  const { data: recent } = useGeneratedDocuments({ q: query || undefined });

  if (!capabilitiesLoading && !hasServerPermission("documents.view")) return <PermissionDenied action="view Document Studio" role={roleLabels[role]} backHref="/" />;
  const s = dashboard ?? { activeTemplates: 0, generatedToday: 0, generatedThisMonth: 0, voidedCount: 0, studentDocuments: 0, staffDocuments: 0 };

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><Files className="size-5 text-primary" /> Document Studio</h1>
          <p className="text-xs text-muted-foreground">ID cards · Certificates</p>
        </div>
        <div className="flex flex-wrap gap-xs">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search documents…" aria-label="Search documents" className="w-40 rounded-md border border-border bg-surface py-1.5 px-3 text-sm text-foreground outline-none focus:border-primary sm:w-52" />
          {hasServerPermission("documents.generate") && <Button asChild size="sm"><Link href="/documents/generate"><Sparkles className="size-3.5" /> Generate</Link></Button>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Active templates" value={String(s.activeTemplates)} icon={LayoutTemplate} tone="neutral" />
        <StatTile label="Generated today" value={String(s.generatedToday)} icon={Sparkles} tone="info" />
        <StatTile label="This month" value={String(s.generatedThisMonth)} icon={BadgeCheck} tone="success" />
        <StatTile label="Student documents" value={String(s.studentDocuments)} tone="neutral" />
        <StatTile label="Staff documents" value={String(s.staffDocuments)} tone="neutral" />
        <StatTile label="Voided" value={String(s.voidedCount)} tone={s.voidedCount > 0 ? "warning" : "success"} />
      </div>

      <section className="rounded-lg border border-border bg-surface p-md">
        <div className="mb-sm flex items-center justify-between"><h2 className="text-sm font-semibold text-foreground">Recent documents</h2><Link href="/documents/history" className="text-xs text-primary">History →</Link></div>
        <div className="flex flex-col gap-xs">
          {recent.slice(0, 8).map((d) => (
            <Link key={d.id} href={`/documents/history/${d.id}`} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm text-sm transition hover:border-primary/40">
              <div className="min-w-0"><p className="truncate font-medium text-foreground">{d.recipientName}</p><p className="truncate text-xs text-muted-foreground">{d.docType} · {d.documentNumber} · {formatDateTime(d.generatedAt)}</p></div>
              <Badge tone={statusTone[d.status]}>{d.status}</Badge>
            </Link>
          ))}
          {recent.length === 0 && <p className="py-md text-center text-sm text-muted-foreground">No documents match your search.</p>}
        </div>
      </section>

      <div className="flex flex-wrap gap-xs">
        <Button asChild size="sm" variant="outline"><Link href="/documents/templates"><LayoutTemplate className="size-3.5" /> Templates</Link></Button>
        <Button asChild size="sm" variant="outline"><Link href="/id-cards"><IdCard className="size-3.5" /> ID cards</Link></Button>
        <Button asChild size="sm" variant="outline"><Link href="/certificates"><BadgeCheck className="size-3.5" /> Certificates</Link></Button>
      </div>
    </div>
  );
}
