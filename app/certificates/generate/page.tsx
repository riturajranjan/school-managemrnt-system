"use client";

// Generate certificate (Phase 9V) — real PostgreSQL/API cutover, scoped to
// the certificate docTypes with real backing (bonafide, study, achievement,
// employment). Transfer/character/participation/sports certificates stay
// deferred — no real policy exists for any of them.
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RealDocumentGenerator } from "@/components/documents/real-document-generator";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { roleLabels } from "@/lib/permissions/roles";

export default function GenerateCertificatePage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  if (!capabilitiesLoading && !hasServerPermission("documents.generate")) return <PermissionDenied action="generate certificates" role={roleLabels[role]} backHref="/certificates" />;
  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-2"><Button asChild size="sm" variant="ghost"><Link href="/certificates"><ArrowLeft className="size-4" /></Link></Button><div><h1 className="text-lg font-semibold text-foreground">Generate certificate</h1><p className="text-xs text-muted-foreground">Bonafide, study, achievement, and employment certificates.</p></div></div>
      <RealDocumentGenerator docTypeFilter={["bonafide-certificate", "study-certificate", "achievement-certificate", "employment-certificate"]} />
    </div>
  );
}
