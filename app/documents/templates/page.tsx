"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Copy, LayoutTemplate, Plus, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { documentKindLabels, paperSizeLabels, type DocumentKind } from "@/lib/types/documents";
import { formatDate } from "@/lib/utils";

const kinds: DocumentKind[] = ["id-card", "student-certificate", "staff-certificate", "activity-certificate", "letter", "admit-card", "receipt", "report-document", "visitor-badge", "custom"];
const statusTone = { active: "success", draft: "warning", archived: "neutral" } as const;

export default function TemplateLibraryPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [kind, setKind] = useState<DocumentKind | "all">("all");

  const templates = useMemo(() => db.documentTemplates.filter((t) => (kind === "all" ? true : t.kind === kind)), [db.documentTemplates, kind]);

  if (!can("documents.view")) return <PermissionDenied action="view templates" role={roleLabels[role]} backHref="/documents" />;
  const canManage = can("documents.manageTemplates");

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><LayoutTemplate className="size-5 text-primary" /> Template library</h1><p className="text-xs text-muted-foreground">{db.documentTemplates.length} templates</p></div>
        {canManage && <Button asChild size="sm"><Link href="/documents/templates/new"><Plus className="size-3.5" /> New template</Link></Button>}
      </div>

      <div className="flex flex-wrap gap-1">
        <button type="button" onClick={() => setKind("all")} className={`rounded-pill px-2.5 py-1 text-xs font-medium transition ${kind === "all" ? "bg-primary text-primary-foreground" : "bg-surface-secondary text-muted-foreground hover:text-foreground"}`}>All</button>
        {kinds.map((k) => <button key={k} type="button" onClick={() => setKind(k)} className={`rounded-pill px-2.5 py-1 text-xs font-medium transition ${kind === k ? "bg-primary text-primary-foreground" : "bg-surface-secondary text-muted-foreground hover:text-foreground"}`}>{documentKindLabels[k]}</button>)}
      </div>

      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => (
          <div key={t.id} className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
            {/* Thumbnail */}
            <div className="relative flex h-24 items-center justify-center overflow-hidden rounded-md border border-border" style={{ background: `linear-gradient(135deg, ${t.accent}18, ${t.accent}05)` }}>
              <span className="flex size-10 items-center justify-center rounded-md text-white" style={{ background: t.accent }}><LayoutTemplate className="size-5" /></span>
              {t.isDefault && <span className="absolute right-1.5 top-1.5"><Star className="size-3.5 fill-warning text-warning" /></span>}
            </div>
            <div className="flex items-start justify-between gap-sm">
              <div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{t.name}</p><p className="truncate text-xs text-muted-foreground">{documentKindLabels[t.kind]} · {paperSizeLabels[t.paperSize]} · {t.orientation}</p></div>
              <Badge tone={statusTone[t.status]}>{t.status}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{t.usageCount} uses · updated {formatDate(t.updatedAt)}</p>
            <div className="flex flex-wrap gap-1">
              <Button asChild size="sm" variant="outline"><Link href={`/documents/templates/${t.id}`}>{canManage ? "Edit" : "Preview"}</Link></Button>
              {can("documents.generate") && <Button asChild size="sm" variant="ghost"><Link href={`/documents/generate?template=${t.id}`}>Generate</Link></Button>}
              {canManage && <Button size="sm" variant="ghost" disabled title="Duplicate (simulation)"><Copy className="size-3.5" /></Button>}
            </div>
          </div>
        ))}
        {templates.length === 0 && <div className="col-span-full rounded-lg border border-dashed border-border p-2xl text-center text-sm text-muted-foreground">No templates in this category.</div>}
      </div>
    </div>
  );
}
