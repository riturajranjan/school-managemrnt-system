"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DocumentGenerator } from "@/components/documents/document-generator";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { roleLabels } from "@/lib/permissions/roles";

export default function GenerateCertificatePage() {
  const { can, role } = usePermissions();
  if (!can("documents.generate")) return <PermissionDenied action="generate certificates" role={roleLabels[role]} backHref="/certificates" />;
  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-2"><Button asChild size="sm" variant="ghost"><Link href="/certificates"><ArrowLeft className="size-4" /></Link></Button><div><h1 className="text-lg font-semibold text-foreground">Generate certificate</h1><p className="text-xs text-muted-foreground">Bonafide, transfer, character, study, participation and more.</p></div></div>
      <DocumentGenerator templateFilter={(t) => t.kind === "student-certificate" || t.kind === "staff-certificate" || t.kind === "activity-certificate"} generatedBy={roleLabels[role]} />
    </div>
  );
}
