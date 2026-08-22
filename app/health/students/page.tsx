"use client";

// Student health directory (Phase 9R) — real PostgreSQL/API cutover. Any
// real, active Student can have infirmary/profile records, so this lists
// real students directly (no separate "has a health profile" bulk query —
// that would require an aggregation endpoint beyond this phase's scope);
// sensitive detail (allergies etc.) is only ever shown on the detail page.
import Link from "next/link";
import { useState } from "react";
import { Search, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PrivacyNotice } from "@/components/campus/privacy";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useStudentList } from "@/lib/hooks/api/use-students";
import { roleLabels } from "@/lib/permissions/roles";

export default function StudentHealthDirectoryPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const [query, setQuery] = useState("");
  const { data: students, meta } = useStudentList({ status: ["active"], search: query || undefined, pageSize: 60 });

  if (!capabilitiesLoading && !hasServerPermission("health.view")) return <PermissionDenied action="view student health" role={roleLabels[role]} backHref="/health" />;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="text-lg font-semibold text-foreground">Student health profiles</h1><p className="text-xs text-muted-foreground">{meta?.total ?? students.length} students · access is restricted and audited</p></div>
      <PrivacyNotice />
      <div className="relative"><Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search student…" className="pl-8" aria-label="Search" /></div>
      {students.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center"><UsersRound className="size-6 text-muted-foreground" /><p className="text-sm text-muted-foreground">No records found.</p></div>
      ) : (
        <div className="flex flex-col gap-sm">
          {students.map((s) => (
            <Link key={s.id} href={`/health/students/${s.id}`} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm hover:border-primary/40">
              <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{s.fullName}</p><p className="truncate text-xs text-muted-foreground">{s.classLabel}{s.sectionLabel ? `-${s.sectionLabel}` : ""}</p></div>
              <Badge tone="neutral">View record</Badge>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
