"use client";

import Link from "next/link";
import { ArrowLeft, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DocumentGenerator } from "@/components/documents/document-generator";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { roleLabels } from "@/lib/permissions/roles";

export default function GenerateAdmitCardPage() {
  const { can, role } = usePermissions();
  if (!can("documents.manageAdmitCards") && !can("documents.generate")) return <PermissionDenied action="generate admit cards" role={roleLabels[role]} backHref="/admit-cards" />;
  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-2"><Button asChild size="sm" variant="ghost"><Link href="/admit-cards"><ArrowLeft className="size-4" /></Link></Button><div><h1 className="text-lg font-semibold text-foreground">Generate admit card</h1><p className="text-xs text-muted-foreground">Single card here — use Batch for a whole class or section.</p></div></div>
      <p className="flex items-start gap-1 rounded-md border border-primary/25 bg-primary/5 p-sm text-xs text-primary"><Info className="mt-0.5 size-3.5 shrink-0" /> For class or section batches, use <Link href="/documents/batch" className="underline">Batch generation</Link>.</p>
      <DocumentGenerator templateFilter={(t) => t.kind === "admit-card"} generatedBy={roleLabels[role]} />
    </div>
  );
}
