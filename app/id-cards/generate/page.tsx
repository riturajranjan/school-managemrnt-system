"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DocumentGenerator } from "@/components/documents/document-generator";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { roleLabels } from "@/lib/permissions/roles";

export default function GenerateIdCardPage() {
  const { can, role } = usePermissions();
  if (!can("documents.manageIdCards") && !can("documents.generate")) return <PermissionDenied action="generate ID cards" role={roleLabels[role]} backHref="/id-cards" />;
  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-2"><Button asChild size="sm" variant="ghost"><Link href="/id-cards"><ArrowLeft className="size-4" /></Link></Button><div><h1 className="text-lg font-semibold text-foreground">Generate ID card</h1><p className="text-xs text-muted-foreground">Preview updates live as you choose a template and holder.</p></div></div>
      <DocumentGenerator templateFilter={(t) => t.kind === "id-card" || t.kind === "visitor-badge"} generatedBy={roleLabels[role]} />
    </div>
  );
}
