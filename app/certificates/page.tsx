"use client";

// Certificates hub (Phase 9V) — real PostgreSQL/API cutover.
import Link from "next/link";
import { Award, FileBadge, GraduationCap, Sparkles, Trophy, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useGeneratedDocuments } from "@/lib/hooks/api/use-document-studio-api";
import { roleLabels } from "@/lib/permissions/roles";

export default function CertificatesHubPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: studentDocs } = useGeneratedDocuments({ docType: "bonafide-certificate" });
  const { data: studyDocs } = useGeneratedDocuments({ docType: "study-certificate" });
  const { data: staffDocs } = useGeneratedDocuments({ docType: "employment-certificate" });
  const { data: activityDocs } = useGeneratedDocuments({ docType: "achievement-certificate" });

  if (!capabilitiesLoading && !hasServerPermission("documents.view")) return <PermissionDenied action="view certificates" role={roleLabels[role]} backHref="/documents" />;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><FileBadge className="size-5 text-primary" /> Certificates</h1><p className="text-xs text-muted-foreground">Student · Staff · Activity certificates</p></div>
        {hasServerPermission("documents.generate") && <Button asChild size="sm"><Link href="/certificates/generate"><Sparkles className="size-3.5" /> Generate</Link></Button>}
      </div>

      <div className="grid grid-cols-1 gap-sm sm:grid-cols-3">
        <Link href="/certificates/student"><StatTile label="Student certificates" value={String(studentDocs.length + studyDocs.length)} icon={GraduationCap} tone="info" /></Link>
        <Link href="/certificates/staff"><StatTile label="Staff certificates" value={String(staffDocs.length)} icon={UserCog} tone="neutral" /></Link>
        <Link href="/certificates/activities"><StatTile label="Activity certificates" value={String(activityDocs.length)} icon={Award} tone="success" /></Link>
      </div>

      <div className="flex flex-wrap gap-xs">
        <Button asChild size="sm" variant="outline"><Link href="/certificates/student"><GraduationCap className="size-3.5" /> Student</Link></Button>
        <Button asChild size="sm" variant="outline"><Link href="/certificates/staff"><UserCog className="size-3.5" /> Staff</Link></Button>
        <Button asChild size="sm" variant="outline"><Link href="/certificates/activities"><Trophy className="size-3.5" /> Activities</Link></Button>
        <Button asChild size="sm" variant="outline"><Link href="/certificates/templates"><FileBadge className="size-3.5" /> Templates</Link></Button>
      </div>
    </div>
  );
}
