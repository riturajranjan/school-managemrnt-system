"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GeneratedDocList } from "@/components/documents/generated-doc-list";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { roleLabels } from "@/lib/permissions/roles";

export default function StudentLettersPage() {
  const { can, role } = usePermissions();
  if (!can("documents.view")) return <PermissionDenied action="view student letters" role={roleLabels[role]} backHref="/letters" />;
  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-2"><Button asChild size="sm" variant="ghost"><Link href="/letters"><ArrowLeft className="size-4" /></Link></Button><div><h1 className="text-lg font-semibold text-foreground">Student letters</h1><p className="text-xs text-muted-foreground">Recommendation and custom letters</p></div></div>
      <GeneratedDocList kinds={["custom"]} emptyLabel="No student letters yet. Use the generator to create one." />
    </div>
  );
}
