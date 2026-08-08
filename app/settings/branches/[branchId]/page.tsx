"use client";

import Link from "next/link";
import { use, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useBranches } from "@/lib/hooks/use-admin";
import { roleLabels } from "@/lib/permissions/roles";
import { branchStatusLabels, branchStatusTone } from "@/lib/types/admin";
import { cn } from "@/lib/utils";

const TABS = ["Overview", "Academic", "Departments", "Users", "Modules", "Branding", "Contact", "Activity"] as const;

export default function BranchDetailPage({ params }: { params: Promise<{ branchId: string }> }) {
  const { branchId } = use(params);
  const { role } = usePermissions();
  const branch = useBranches().find((b) => b.id === branchId);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");

  const canView = role === "super-admin" || role === "administrator" || role === "principal" || role === "school-owner";
  if (!canView) return <PermissionDenied action="view this branch" role={roleLabels[role]} backHref="/settings/branches" />;
  if (!branch) return <div className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Branch not found. <Link href="/settings/branches" className="text-primary">Back</Link></div>;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="ghost"><Link href="/settings/branches"><ArrowLeft className="size-4" /></Link></Button>
        <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h1 className="truncate text-lg font-semibold text-foreground">{branch.name}</h1><Badge tone={branchStatusTone[branch.status]}>{branchStatusLabels[branch.status]}</Badge></div><p className="text-xs text-muted-foreground">{branch.code} · {branch.city} · Head: {branch.headName}</p></div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => <button key={t} type="button" onClick={() => setTab(t)} className={cn("whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition", tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>{t}</button>)}
      </div>

      {tab === "Overview" && (
        <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
          <StatTile label="Students" value={String(branch.studentCount)} tone="info" />
          <StatTile label="Staff" value={String(branch.staffCount)} tone="neutral" />
          <StatTile label="Classes" value={String(branch.classesCount)} tone="neutral" />
          <StatTile label="Modules" value={String(branch.modulesEnabled)} tone="success" />
          <StatTile label="Session" value={branch.session} tone="info" />
          <StatTile label="Completeness" value={`${branch.completeness}%`} tone={branch.completeness >= 80 ? "success" : "warning"} />
        </div>
      )}
      {tab === "Contact" && (
        <div className="rounded-lg border border-border bg-surface p-md text-sm">
          <dl className="grid grid-cols-1 gap-y-1.5 sm:grid-cols-2">
            <div><dt className="text-xs text-muted-foreground">Address</dt><dd className="text-foreground">{branch.address}, {branch.city}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Contact</dt><dd className="text-foreground">{branch.contact}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Head</dt><dd className="text-foreground">{branch.headName}</dd></div>
          </dl>
        </div>
      )}
      {tab !== "Overview" && tab !== "Contact" && (
        <div className="rounded-lg border border-dashed border-border p-2xl text-center text-sm text-muted-foreground">
          {tab} configuration for this branch is managed in the respective module settings. This is a configuration overview (frontend mock).
        </div>
      )}
    </div>
  );
}
