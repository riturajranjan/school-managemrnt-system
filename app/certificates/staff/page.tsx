"use client";

// Staff certificates (Phase 9V) — real PostgreSQL/API cutover.
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RealGeneratedDocList } from "@/components/documents/real-generated-doc-list";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { roleLabels } from "@/lib/permissions/roles";

export default function StaffCertificatesPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  if (!capabilitiesLoading && !hasServerPermission("documents.view")) return <PermissionDenied action="view Staff certificates" role={roleLabels[role]} backHref="/certificates" />;
  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2"><Button asChild size="sm" variant="ghost"><Link href="/certificates"><ArrowLeft className="size-4" /></Link></Button><div><h1 className="text-lg font-semibold text-foreground">Staff certificates</h1><p className="text-xs text-muted-foreground">Preview and void issued certificates</p></div></div>
        {hasServerPermission("documents.generate") && <Button asChild size="sm"><Link href="/certificates/generate"><Sparkles className="size-3.5" /> Generate</Link></Button>}
      </div>
      <RealGeneratedDocList docTypes={["employment-certificate"]} emptyLabel="No staff certificates yet." />
    </div>
  );
}
