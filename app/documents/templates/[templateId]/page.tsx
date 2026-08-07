"use client";

import Link from "next/link";
import { use } from "react";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TemplateBuilder } from "@/components/documents/template-builder";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { documentKindLabels } from "@/lib/types/documents";

export default function TemplateBuilderPage({ params }: { params: Promise<{ templateId: string }> }) {
  const { templateId } = use(params);
  const db = useSisStore();
  const { can, role } = usePermissions();

  const template = db.documentTemplates.find((t) => t.id === templateId);
  if (!can("documents.view")) return <PermissionDenied action="view this template" role={roleLabels[role]} backHref="/documents/templates" />;
  if (!template) return <div className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Template not found. <Link href="/documents/templates" className="text-primary">Back</Link></div>;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="ghost"><Link href="/documents/templates"><ArrowLeft className="size-4" /></Link></Button>
        <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h1 className="truncate text-lg font-semibold text-foreground">{template.name}</h1>{template.isDefault && <Badge tone="success">Default</Badge>}</div><p className="text-xs text-muted-foreground">{documentKindLabels[template.kind]} · {template.usageCount} uses</p></div>
      </div>
      {can("documents.manageTemplates") ? (
        <TemplateBuilder initial={template} />
      ) : (
        <TemplateBuilder initial={template} />
      )}
    </div>
  );
}
