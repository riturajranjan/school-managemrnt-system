"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, BadgeCheck, FileStack, Files, IdCard, LayoutTemplate, Printer, QrCode, Search, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { DocumentFlow } from "@/components/documents/document-flow";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { documentFlowCounts, documentsSummary } from "@/lib/selectors/documents-brief";
import { roleLabels } from "@/lib/permissions/roles";
import { documentStatusLabels, documentStatusTone, documentTypeLabels, flowStageLabels, type FlowStage } from "@/lib/types/documents";
import { formatDate } from "@/lib/utils";

export default function DocumentStudioPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [stage, setStage] = useState<FlowStage | null>(null);
  const [query, setQuery] = useState("");

  const summary = useMemo(() => documentsSummary(db), [db]);
  const flow = useMemo(() => documentFlowCounts(db), [db]);
  const recent = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...db.generatedDocuments]
      .filter((d) => (q ? d.number.toLowerCase().includes(q) || d.recipient.name.toLowerCase().includes(q) : true))
      .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt)).slice(0, 8);
  }, [db.generatedDocuments, query]);
  const pendingPrint = useMemo(() => db.printQueue.filter((p) => p.status === "queued" || p.status === "ready" || p.status === "preparing"), [db.printQueue]);
  const missingTemplates = useMemo(() => db.documentTemplates.filter((t) => t.status === "draft"), [db.documentTemplates]);

  if (!can("documents.view")) return <PermissionDenied action="view Document Studio" role={roleLabels[role]} backHref="/" />;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><Files className="size-5 text-primary" /> Document Studio</h1>
          <p className="text-xs text-muted-foreground">ID cards · Certificates · Letters · Admit cards · Print centre · Verification</p>
        </div>
        <div className="flex flex-wrap gap-xs">
          <div className="relative"><Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search documents…" aria-label="Search documents" className="w-40 rounded-md border border-border bg-surface py-1.5 pl-8 pr-3 text-sm text-foreground outline-none focus:border-primary sm:w-52" /></div>
          {can("documents.generate") && <Button asChild size="sm"><Link href="/documents/generate"><Sparkles className="size-3.5" /> Generate</Link></Button>}
          {can("documents.batch") && <Button asChild size="sm" variant="outline"><Link href="/documents/batch"><FileStack className="size-3.5" /> Batch</Link></Button>}
        </div>
      </div>

      {/* Document Flow */}
      <section className="rounded-lg border border-border bg-surface p-md">
        <div className="mb-sm flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Document Flow</h2>
          {stage && <button type="button" onClick={() => setStage(null)} className="text-xs text-primary">Clear filter · {flowStageLabels[stage]}</button>}
        </div>
        <DocumentFlow counts={flow} active={stage} onSelect={(s) => setStage((cur) => (cur === s ? null : s))} />
        {stage && <p className="mt-sm text-xs text-muted-foreground">Showing the pipeline focused on <span className="font-medium text-foreground">{flowStageLabels[stage]}</span> — {flow[stage]} item(s) at this stage.</p>}
      </section>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-sm sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label="Generated today" value={String(summary.generatedToday)} icon={Sparkles} tone="info" />
        <StatTile label="Pending print" value={String(summary.pendingPrint)} icon={Printer} tone={summary.pendingPrint > 0 ? "warning" : "success"} />
        <StatTile label="Certificates" value={String(summary.certificatesIssued)} icon={BadgeCheck} tone="success" />
        <StatTile label="ID cards issued" value={String(summary.idCardsIssued)} icon={IdCard} tone="info" />
        <StatTile label="Templates" value={String(summary.templates)} icon={LayoutTemplate} tone="neutral" />
        <StatTile label="Batch jobs" value={String(summary.batchJobs)} icon={FileStack} tone="neutral" />
        <StatTile label="Verification checks" value={String(summary.verificationChecks)} icon={QrCode} tone="info" />
        <StatTile label="Failed jobs" value={String(summary.failedJobs)} icon={AlertTriangle} tone={summary.failedJobs > 0 ? "error" : "success"} />
        <StatTile label="Expiring IDs" value={String(summary.expiringIds)} tone={summary.expiringIds > 0 ? "warning" : "success"} />
        <StatTile label="Drafts" value={String(summary.draftDocuments)} tone="neutral" />
      </div>

      <div className="grid grid-cols-1 gap-md lg:grid-cols-2">
        {/* Recent documents */}
        <section className="rounded-lg border border-border bg-surface p-md">
          <div className="mb-sm flex items-center justify-between"><h2 className="text-sm font-semibold text-foreground">Recent documents</h2><Link href="/documents/history" className="text-xs text-primary">History →</Link></div>
          <div className="flex flex-col gap-xs">
            {recent.map((d) => (
              <Link key={d.id} href={`/documents/history/${d.id}`} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm text-sm transition hover:border-primary/40">
                <div className="min-w-0"><p className="truncate font-medium text-foreground">{d.recipient.name}</p><p className="truncate text-xs text-muted-foreground">{documentTypeLabels[d.type]} · {d.number} · {formatDate(d.generatedAt.slice(0, 10))}</p></div>
                <Badge tone={documentStatusTone[d.status]}>{documentStatusLabels[d.status]}</Badge>
              </Link>
            ))}
            {recent.length === 0 && <p className="py-md text-center text-sm text-muted-foreground">No documents match your search.</p>}
          </div>
        </section>

        {/* Needs action */}
        <section className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm text-sm font-semibold text-foreground">Needs action</h2>
          <div className="flex flex-col gap-sm">
            <ActionRow href="/documents/print-queue" label="Documents waiting for print" count={pendingPrint.length} tone={pendingPrint.length > 0 ? "warning" : "success"} icon={Printer} />
            <ActionRow href="/documents/templates" label="Templates in draft (incomplete)" count={missingTemplates.length} tone={missingTemplates.length > 0 ? "warning" : "success"} icon={LayoutTemplate} />
            <ActionRow href="/documents/batch" label="Failed batch jobs" count={summary.failedJobs} tone={summary.failedJobs > 0 ? "error" : "success"} icon={AlertTriangle} />
            <ActionRow href="/id-cards" label="ID cards expiring within 30 days" count={summary.expiringIds} tone={summary.expiringIds > 0 ? "warning" : "success"} icon={IdCard} />
          </div>
          <div className="mt-md flex flex-wrap gap-xs">
            <Button asChild size="sm" variant="outline"><Link href="/documents/templates"><LayoutTemplate className="size-3.5" /> Templates</Link></Button>
            <Button asChild size="sm" variant="outline"><Link href="/documents/verification"><QrCode className="size-3.5" /> Verify</Link></Button>
            <Button asChild size="sm" variant="outline"><Link href="/id-cards"><IdCard className="size-3.5" /> ID cards</Link></Button>
          </div>
        </section>
      </div>
    </div>
  );
}

function ActionRow({ href, label, count, tone, icon: Icon }: { href: string; label: string; count: number; tone: "warning" | "error" | "success"; icon: typeof Printer }) {
  return (
    <Link href={href} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm text-sm transition hover:border-primary/40">
      <span className="flex items-center gap-2 text-foreground"><Icon className="size-4 text-muted-foreground" /> {label}</span>
      <Badge tone={tone}>{count}</Badge>
    </Link>
  );
}
