"use client";

// Certificate templates (Phase 9V) — real PostgreSQL/API cutover, filtered to
// student/staff certificate kinds (activity achievement certificates use the
// student-certificate kind too — see the taxonomy in
// lib/server/document-studio/taxonomy.ts).
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useDocumentTemplates } from "@/lib/hooks/api/use-document-studio-api";
import { roleLabels } from "@/lib/permissions/roles";
import { formatDate } from "@/lib/utils";

export default function CertificateTemplatesPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: studentCerts } = useDocumentTemplates({ kind: "student-certificate" });
  const { data: staffCerts } = useDocumentTemplates({ kind: "staff-certificate" });
  const templates = [...studentCerts, ...staffCerts];

  if (!capabilitiesLoading && !hasServerPermission("documents.view")) return <PermissionDenied action="view certificate templates" role={roleLabels[role]} backHref="/certificates" />;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-2"><Button asChild size="sm" variant="ghost"><Link href="/certificates"><ArrowLeft className="size-4" /></Link></Button><div><h1 className="text-lg font-semibold text-foreground">Certificate templates</h1><p className="text-xs text-muted-foreground">{templates.length} templates</p></div></div>
      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => (
          <Link key={t.id} href={`/documents/templates/${t.id}`} className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md transition hover:border-primary/40">
            <div className="flex h-20 items-center justify-center rounded-md border" style={{ borderColor: t.accent, background: `${t.accent}10` }}><span className="text-sm font-bold" style={{ color: t.accent }}>{t.docType}</span></div>
            <div className="flex items-start justify-between gap-sm"><div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{t.name}</p><p className="truncate text-xs text-muted-foreground">{t.paperSize} · {t.orientation}</p></div><Badge tone={t.status === "active" ? "success" : "neutral"}>{t.status}</Badge></div>
            <p className="text-xs text-muted-foreground">{t.usageCount} uses · updated {formatDate(t.updatedAt)}</p>
          </Link>
        ))}
        {templates.length === 0 && <div className="col-span-full rounded-lg border border-dashed border-border p-2xl text-center text-sm text-muted-foreground">No certificate templates yet.</div>}
      </div>
    </div>
  );
}
