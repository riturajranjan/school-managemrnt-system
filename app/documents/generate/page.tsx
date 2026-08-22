"use client";

// Generate document (Phase 9V) — real PostgreSQL/API cutover.
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Sparkles } from "lucide-react";
import { RealDocumentGenerator } from "@/components/documents/real-document-generator";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { roleLabels } from "@/lib/permissions/roles";

function GenerateInner() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const params = useSearchParams();
  const template = params.get("template") ?? undefined;
  if (!capabilitiesLoading && !hasServerPermission("documents.generate")) return <PermissionDenied action="generate documents" role={roleLabels[role]} backHref="/documents" />;
  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><Sparkles className="size-5 text-primary" /> Generate document</h1><p className="text-xs text-muted-foreground">Select template, recipient and fields — preview updates live.</p></div>
      <RealDocumentGenerator initialTemplateId={template} />
    </div>
  );
}

export default function GenerateDocumentPage() {
  return <Suspense fallback={<div className="p-md text-sm text-muted-foreground">Loading…</div>}><GenerateInner /></Suspense>;
}
