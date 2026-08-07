"use client";

import Link from "next/link";
import { useMemo } from "react";
import { FileSignature, LayoutTemplate, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { GeneratedDocList } from "@/components/documents/generated-doc-list";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";

export default function AdmitCardsPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const count = useMemo(() => db.generatedDocuments.filter((d) => d.kind === "admit-card").length, [db.generatedDocuments]);
  const batches = useMemo(() => db.documentBatches.filter((b) => b.docType === "admit-card").length, [db.documentBatches]);

  if (!can("documents.view")) return <PermissionDenied action="view admit cards" role={roleLabels[role]} backHref="/documents" />;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><FileSignature className="size-5 text-primary" /> Exam admit cards</h1><p className="text-xs text-muted-foreground">Single, class-batch or section-batch generation</p></div>
        <div className="flex gap-xs">
          {can("documents.manageAdmitCards") && <Button asChild size="sm"><Link href="/admit-cards/generate"><Sparkles className="size-3.5" /> Generate</Link></Button>}
          <Button asChild size="sm" variant="outline"><Link href="/admit-cards/templates"><LayoutTemplate className="size-3.5" /> Templates</Link></Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-3">
        <StatTile label="Admit cards" value={String(count)} icon={FileSignature} tone="info" />
        <Link href="/documents/batch"><StatTile label="Admit batches" value={String(batches)} tone="neutral" /></Link>
      </div>

      <GeneratedDocList kinds={["admit-card"]} emptyLabel="No admit cards yet — generate for a class or section." />
    </div>
  );
}
