"use client";

// Template library (Phase 9V) — real PostgreSQL/API cutover.
import Link from "next/link";
import { useState } from "react";
import { LayoutTemplate, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useDocumentTemplates } from "@/lib/hooks/api/use-document-studio-api";
import { roleLabels } from "@/lib/permissions/roles";
import type { DocTypeDto } from "@/lib/api/contracts";

const DOC_TYPE_LABEL: Record<DocTypeDto, string> = {
  "student-id": "Student ID card", "staff-id": "Staff ID card", "bonafide-certificate": "Bonafide certificate",
  "study-certificate": "Study certificate", "achievement-certificate": "Activity achievement certificate", "employment-certificate": "Employment certificate",
};
const statusTone = { active: "success", draft: "warning", archived: "neutral" } as const;

export default function TemplateLibraryPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const [docType, setDocType] = useState<DocTypeDto | "all">("all");
  const { data: templates } = useDocumentTemplates(docType === "all" ? {} : { docType });

  if (!capabilitiesLoading && !hasServerPermission("documents.view")) return <PermissionDenied action="view templates" role={roleLabels[role]} backHref="/documents" />;
  const canManage = hasServerPermission("documents.manageTemplates");

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><LayoutTemplate className="size-5 text-primary" /> Template library</h1><p className="text-xs text-muted-foreground">{templates.length} templates</p></div>
        {canManage && <Button asChild size="sm"><Link href="/documents/templates/new"><Plus className="size-3.5" /> New template</Link></Button>}
      </div>

      <div className="flex flex-wrap gap-1">
        <button type="button" onClick={() => setDocType("all")} className={`rounded-pill px-2.5 py-1 text-xs font-medium transition ${docType === "all" ? "bg-primary text-primary-foreground" : "bg-surface-secondary text-muted-foreground hover:text-foreground"}`}>All</button>
        {(Object.keys(DOC_TYPE_LABEL) as DocTypeDto[]).map((k) => <button key={k} type="button" onClick={() => setDocType(k)} className={`rounded-pill px-2.5 py-1 text-xs font-medium transition ${docType === k ? "bg-primary text-primary-foreground" : "bg-surface-secondary text-muted-foreground hover:text-foreground"}`}>{DOC_TYPE_LABEL[k]}</button>)}
      </div>

      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => (
          <div key={t.id} className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
            <div className="relative flex h-24 items-center justify-center overflow-hidden rounded-md border border-border" style={{ background: `linear-gradient(135deg, ${t.accent}18, ${t.accent}05)` }}>
              <span className="flex size-10 items-center justify-center rounded-md text-white" style={{ background: t.accent }}><LayoutTemplate className="size-5" /></span>
            </div>
            <div className="flex items-start justify-between gap-sm">
              <div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{t.name}</p><p className="truncate text-xs text-muted-foreground">{DOC_TYPE_LABEL[t.docType]} · v{t.version}</p></div>
              <Badge tone={statusTone[t.status]}>{t.status}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{t.usageCount} uses</p>
            <div className="flex flex-wrap gap-1">
              <Button asChild size="sm" variant="outline"><Link href={`/documents/templates/${t.id}`}>{canManage ? "Edit" : "Preview"}</Link></Button>
              {hasServerPermission("documents.generate") && t.status === "active" && <Button asChild size="sm" variant="ghost"><Link href={`/documents/generate?template=${t.id}`}>Generate</Link></Button>}
            </div>
          </div>
        ))}
        {templates.length === 0 && <div className="col-span-full rounded-lg border border-dashed border-border p-2xl text-center text-sm text-muted-foreground">No templates in this category.</div>}
      </div>
    </div>
  );
}
