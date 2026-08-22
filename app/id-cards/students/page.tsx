"use client";

// Student ID cards (Phase 9V) — real PostgreSQL/API cutover.
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RealIdCardList } from "@/components/documents/real-id-card-list";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { roleLabels } from "@/lib/permissions/roles";

export default function StudentIdCardsPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  if (!capabilitiesLoading && !hasServerPermission("documents.view")) return <PermissionDenied action="view student ID cards" role={roleLabels[role]} backHref="/id-cards" />;
  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-2"><Button asChild size="sm" variant="ghost"><Link href="/id-cards"><ArrowLeft className="size-4" /></Link></Button><div><h1 className="text-lg font-semibold text-foreground">Student ID cards</h1><p className="text-xs text-muted-foreground">Generate, preview and void</p></div></div>
      <RealIdCardList subjectType="student" />
    </div>
  );
}
