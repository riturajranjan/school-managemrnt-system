"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { documentTypeLabels, paperSizeLabels } from "@/lib/types/documents";
import { formatDate } from "@/lib/utils";

export default function LetterTemplatesPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  if (!can("documents.view")) return <PermissionDenied action="view letter templates" role={roleLabels[role]} backHref="/letters" />;
  const templates = db.documentTemplates.filter((t) => t.kind === "letter" || t.kind === "staff-certificate");
  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-2"><Button asChild size="sm" variant="ghost"><Link href="/letters"><ArrowLeft className="size-4" /></Link></Button><div><h1 className="text-lg font-semibold text-foreground">Letter templates</h1><p className="text-xs text-muted-foreground">{templates.length} templates</p></div></div>
      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => (
          <Link key={t.id} href={`/documents/templates/${t.id}`} className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md transition hover:border-primary/40">
            <div className="flex h-16 items-center justify-center rounded-md border" style={{ borderColor: t.accent, background: `${t.accent}0d` }}><span className="text-sm font-bold" style={{ color: t.accent }}>{documentTypeLabels[t.docType]}</span></div>
            <div className="flex items-start justify-between gap-sm"><div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{t.name}</p><p className="truncate text-xs text-muted-foreground">{paperSizeLabels[t.paperSize]}</p></div><Badge tone={t.status === "active" ? "success" : "neutral"}>{t.status}</Badge></div>
            <p className="text-xs text-muted-foreground">{t.usageCount} uses · {formatDate(t.updatedAt)}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
