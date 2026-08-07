"use client";

import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GeneratedDocList } from "@/components/documents/generated-doc-list";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { roleLabels } from "@/lib/permissions/roles";

export default function StaffLettersPage() {
  const { can, role } = usePermissions();
  if (!can("documents.view")) return <PermissionDenied action="view staff letters" role={roleLabels[role]} backHref="/letters" />;
  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2"><Button asChild size="sm" variant="ghost"><Link href="/letters"><ArrowLeft className="size-4" /></Link></Button><div><h1 className="text-lg font-semibold text-foreground">Staff letters</h1><p className="text-xs text-muted-foreground">Offer, appointment, experience, relieving, salary certificates</p></div></div>
        {can("documents.manageLetters") && <Button asChild size="sm"><Link href="/documents/generate"><Sparkles className="size-3.5" /> Generate</Link></Button>}
      </div>
      <GeneratedDocList kinds={["letter", "staff-certificate"]} emptyLabel="No staff letters yet." />
    </div>
  );
}
