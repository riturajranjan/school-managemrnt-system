"use client";

// Template detail/editor (Phase 9V) — real PostgreSQL/API cutover. Reuses the
// existing TemplateBuilder exactly as-is (no redesign); only the data source
// and save/activate/archive actions are real. TemplateBuilder's prop type is
// the mock DocumentTemplate shape — our real DTO is a structural superset of
// it (same field names/shapes, validated server-side against the same
// allowlists), so passing it through needs only a type-system bridge cast,
// not a data transform.
import Link from "next/link";
import { use, useState } from "react";
import { ArrowLeft, Archive, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TemplateBuilder } from "@/components/documents/template-builder";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { activateDocumentTemplateRequest, archiveDocumentTemplateRequest, updateDocumentTemplateRequest, useDocumentTemplate } from "@/lib/hooks/api/use-document-studio-api";
import { roleLabels } from "@/lib/permissions/roles";
import { documentKindLabels } from "@/lib/types/documents";
import type { DocumentTemplate } from "@/lib/types/documents";

export default function TemplateBuilderPage({ params }: { params: Promise<{ templateId: string }> }) {
  const { templateId } = use(params);
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: template, loading, reload } = useDocumentTemplate(templateId);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!capabilitiesLoading && !hasServerPermission("documents.view")) return <PermissionDenied action="view this template" role={roleLabels[role]} backHref="/documents/templates" />;
  if (loading) return <p className="py-2xl text-center text-sm text-muted-foreground">Loading…</p>;
  if (!template) return <div className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Template not found. <Link href="/documents/templates" className="text-primary">Back</Link></div>;

  const canManage = hasServerPermission("documents.manageTemplates");

  async function onSave(edited: DocumentTemplate) {
    setBusy(true);
    const res = await updateDocumentTemplateRequest(templateId, {
      name: edited.name, paperSize: edited.paperSize, orientation: edited.orientation, accent: edited.accent,
      style: edited.style, sections: edited.sections, variables: edited.variables,
    });
    setBusy(false);
    if (!res.success) { setError(res.error.message); return; }
    setError(null);
    reload();
  }

  async function onActivate() {
    setBusy(true);
    const res = await activateDocumentTemplateRequest(templateId);
    setBusy(false);
    if (!res.success) { setError(res.error.message); return; }
    reload();
  }

  async function onArchive() {
    setBusy(true);
    await archiveDocumentTemplateRequest(templateId);
    setBusy(false);
    reload();
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="ghost"><Link href="/documents/templates"><ArrowLeft className="size-4" /></Link></Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2"><h1 className="truncate text-lg font-semibold text-foreground">{template.name}</h1><Badge tone={template.status === "active" ? "success" : template.status === "archived" ? "neutral" : "warning"}>{template.status}</Badge></div>
          <p className="text-xs text-muted-foreground">{documentKindLabels[template.kind]} · v{template.version} · {template.usageCount} uses</p>
        </div>
        {canManage && (
          <div className="flex gap-xs">
            {template.status === "draft" && <Button size="sm" disabled={busy} onClick={onActivate}><CheckCircle2 className="size-3.5" /> Activate</Button>}
            {template.status !== "archived" && <Button size="sm" variant="ghost" disabled={busy} onClick={onArchive}><Archive className="size-3.5" /> Archive</Button>}
          </div>
        )}
      </div>
      {error && <p className="rounded-md border border-error/30 bg-error/8 p-sm text-xs text-error">{error}</p>}
      <TemplateBuilder initial={template as unknown as DocumentTemplate} onSave={canManage ? onSave : undefined} />
    </div>
  );
}
