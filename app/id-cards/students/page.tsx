"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IdCardManager } from "@/components/documents/id-card-manager";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { roleLabels } from "@/lib/permissions/roles";

export default function StudentIdCardsPage() {
  const { can, role } = usePermissions();
  if (!can("documents.view")) return <PermissionDenied action="view student ID cards" role={roleLabels[role]} backHref="/id-cards" />;
  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-2"><Button asChild size="sm" variant="ghost"><Link href="/id-cards"><ArrowLeft className="size-4" /></Link></Button><div><h1 className="text-lg font-semibold text-foreground">Student ID cards</h1><p className="text-xs text-muted-foreground">Generate, preview, print and reissue</p></div></div>
      <IdCardManager kind="student" canManage={can("documents.manageIdCards")} />
    </div>
  );
}
