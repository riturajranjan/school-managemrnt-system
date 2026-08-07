"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { documentTypeLabels, idCardStyleLabels, paperSizeLabels } from "@/lib/types/documents";
import { formatDate } from "@/lib/utils";

export default function IdCardTemplatesPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  if (!can("documents.view")) return <PermissionDenied action="view ID card templates" role={roleLabels[role]} backHref="/id-cards" />;

  const templates = db.documentTemplates.filter((t) => t.kind === "id-card" || t.kind === "visitor-badge");

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-2"><Button asChild size="sm" variant="ghost"><Link href="/id-cards"><ArrowLeft className="size-4" /></Link></Button><div><h1 className="text-lg font-semibold text-foreground">ID card templates</h1><p className="text-xs text-muted-foreground">{templates.length} templates</p></div></div>
      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => (
          <Link key={t.id} href={`/documents/templates/${t.id}`} className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md transition hover:border-primary/40">
            <div className="flex h-20 items-center justify-center rounded-md" style={{ background: `linear-gradient(135deg, ${t.accent}, ${t.accent}88)` }}><span className="text-sm font-bold text-white">{t.style ? idCardStyleLabels[t.style] : "Badge"}</span></div>
            <div className="flex items-start justify-between gap-sm"><div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{t.name}</p><p className="truncate text-xs text-muted-foreground">{documentTypeLabels[t.docType]} · {paperSizeLabels[t.paperSize]}</p></div><Badge tone={t.status === "active" ? "success" : "neutral"}>{t.status}</Badge></div>
            <p className="text-xs text-muted-foreground">{t.usageCount} uses · updated {formatDate(t.updatedAt)}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
