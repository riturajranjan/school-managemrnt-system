"use client";

// ID cards hub (Phase 9V) — HYBRID by design: Student/Staff tiles are real
// (GeneratedDocument docType=student-id|staff-id); Library/Transport/Hostel
// tiles stay on the deferred mock db.idCards (no real per-kind card policy
// exists for those three yet — see the final report's DEFERRED section).
// Because it still reads the mock store for those three tiles, this file is
// deliberately NOT listed in route-mock-guard.test.ts's MIGRATED_FILES.
import Link from "next/link";
import { useMemo } from "react";
import { Bus, GraduationCap, Hotel, IdCard, Library, Sparkles, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { useGeneratedDocuments } from "@/lib/hooks/api/use-document-studio-api";
import { roleLabels } from "@/lib/permissions/roles";

export default function IdCardsHubPage() {
  const db = useSisStore();
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: studentCards } = useGeneratedDocuments({ docType: "student-id" });
  const { data: staffCards } = useGeneratedDocuments({ docType: "staff-id" });

  const deferredCounts = useMemo(() => {
    const map: Record<string, number> = {};
    db.idCards.forEach((c) => { if (c.kind !== "student" && c.kind !== "staff") map[c.kind] = (map[c.kind] ?? 0) + 1; });
    return map;
  }, [db.idCards]);

  if (!capabilitiesLoading && !hasServerPermission("documents.view")) return <PermissionDenied action="view ID cards" role={roleLabels[role]} backHref="/documents" />;

  const HUBS = [
    { kind: "student", href: "/id-cards/students", label: "Student", icon: GraduationCap, count: studentCards.filter((c) => c.status === "generated").length },
    { kind: "staff", href: "/id-cards/staff", label: "Staff", icon: UserCog, count: staffCards.filter((c) => c.status === "generated").length },
    { kind: "library", href: "/id-cards/library", label: "Library", icon: Library, count: deferredCounts.library ?? 0 },
    { kind: "transport", href: "/id-cards/transport", label: "Transport", icon: Bus, count: deferredCounts.transport ?? 0 },
    { kind: "hostel", href: "/id-cards/hostel", label: "Hostel", icon: Hotel, count: deferredCounts.hostel ?? 0 },
  ];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><IdCard className="size-5 text-primary" /> ID cards</h1><p className="text-xs text-muted-foreground">{studentCards.length + staffCards.length} real (student/staff) + deferred (library/transport/hostel)</p></div>
        {hasServerPermission("documents.generate") && <Button asChild size="sm"><Link href="/id-cards/generate"><Sparkles className="size-3.5" /> Generate</Link></Button>}
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-5">
        {HUBS.map((h) => <Link key={h.kind} href={h.href}><StatTile label={`${h.label} cards`} value={String(h.count)} icon={h.icon} tone="info" /></Link>)}
      </div>

      <div className="flex flex-wrap gap-xs">
        {HUBS.map((h) => <Button key={h.kind} asChild size="sm" variant="outline"><Link href={h.href}><h.icon className="size-3.5" /> {h.label}</Link></Button>)}
        <Button asChild size="sm" variant="outline"><Link href="/id-cards/templates"><IdCard className="size-3.5" /> Templates</Link></Button>
      </div>
    </div>
  );
}
