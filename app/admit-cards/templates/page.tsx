"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DocumentSheet } from "@/components/documents/document-sheet";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { paperSizeLabels } from "@/lib/types/documents";
import { formatDate } from "@/lib/utils";

export default function AdmitCardTemplatesPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  if (!can("documents.view")) return <PermissionDenied action="view admit card templates" role={roleLabels[role]} backHref="/admit-cards" />;
  const templates = db.documentTemplates.filter((t) => t.kind === "admit-card");
  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-2"><Button asChild size="sm" variant="ghost"><Link href="/admit-cards"><ArrowLeft className="size-4" /></Link></Button><div><h1 className="text-lg font-semibold text-foreground">Admit card templates</h1><p className="text-xs text-muted-foreground">{templates.length} templates</p></div></div>
      <div className="grid grid-cols-1 gap-md lg:grid-cols-2">
        {templates.map((t) => (
          <div key={t.id} className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
            <div className="flex items-start justify-between gap-sm"><div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{t.name}</p><p className="truncate text-xs text-muted-foreground">{paperSizeLabels[t.paperSize]} · {t.usageCount} uses · {formatDate(t.updatedAt)}</p></div><Badge tone={t.status === "active" ? "success" : "neutral"}>{t.status}</Badge></div>
            <div className="flex justify-center rounded-md bg-surface-secondary/40 p-sm">
              <DocumentSheet data={{ type: "admit-card", kind: "admit-card", paperSize: t.paperSize, number: "ADM-2026-0001", accent: t.accent, recipientName: "Aarav Sharma", recipientSubtitle: "Class 10 · A", fields: { rollNumber: "10A-014", eventName: "Term 1 Examination", centre: "Main Block" }, signatoryName: "Mrs. Anjali Desai", token: "NVX-SAMPLE01" }} />
            </div>
            <Button asChild size="sm" variant="outline"><Link href={`/documents/templates/${t.id}`}>Open template</Link></Button>
          </div>
        ))}
      </div>
    </div>
  );
}
