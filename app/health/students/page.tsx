"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PrivacyNotice } from "@/components/campus/privacy";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";

export default function StudentHealthDirectoryPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [query, setQuery] = useState("");
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return db.healthProfiles.filter((p) => {
      if (!q) return true;
      const s = db.students.find((x) => x.id === p.studentId);
      return s ? `${s.profile.firstName} ${s.profile.lastName}`.toLowerCase().includes(q) : false;
    }).slice(0, 60);
  }, [db.healthProfiles, db.students, query]);

  if (!can("health.view")) return <PermissionDenied action="view student health" role={roleLabels[role]} backHref="/health" />;
  const canSensitive = can("health.viewSensitive");

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="text-lg font-semibold text-foreground">Student health profiles</h1><p className="text-xs text-muted-foreground">{db.healthProfiles.length} records · access is restricted and audited</p></div>
      <PrivacyNotice />
      <div className="relative"><Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search student…" className="pl-8" aria-label="Search" /></div>
      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center"><UsersRound className="size-6 text-muted-foreground" /><p className="text-sm text-muted-foreground">No records found.</p></div>
      ) : (
        <div className="flex flex-col gap-sm">
          {rows.map((p) => { const s = db.students.find((x) => x.id === p.studentId); return (
            <Link key={p.studentId} href={`/health/students/${p.studentId}`} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm hover:border-primary/40">
              <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{s ? `${s.profile.firstName} ${s.profile.lastName}` : p.studentId}</p><p className="truncate text-xs text-muted-foreground">{s?.classId}{canSensitive && p.allergies.length > 0 ? ` · allergies: ${p.allergies.join(", ")}` : canSensitive ? "" : " · detail restricted"}</p></div>
              {canSensitive ? (p.allergies.length > 0 ? <Badge tone="warning">Allergies</Badge> : <Badge tone="neutral">On file</Badge>) : <Badge tone="neutral">Restricted</Badge>}
            </Link>
          ); })}
        </div>
      )}
    </div>
  );
}
