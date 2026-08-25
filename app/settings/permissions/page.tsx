"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { GitCompare, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PermissionMatrix } from "@/components/settings/permission-matrix";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { compareRoles } from "@/lib/selectors/admin-brief";
import { allRoles, roleLabels, type UserRole } from "@/lib/permissions/roles";

function PermissionsInner() {
  const { role, hasServerPermission } = usePermissions();
  const params = useSearchParams();
  const initial = (params.get("role") as UserRole) ?? "teacher";
  const [selected, setSelected] = useState<UserRole>(allRoles.includes(initial) ? initial : "teacher");
  const [compareWith, setCompareWith] = useState<UserRole | "">("");
  const cmp = useMemo(() => (compareWith ? compareRoles(selected, compareWith) : null), [selected, compareWith]);

  const canView = hasServerPermission("settings.view");
  if (!canView) return <PermissionDenied action="view permissions" role={roleLabels[role]} backHref="/settings" />;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-end sm:justify-between">
        <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><KeyRound className="size-5 text-primary" /> Permission matrix</h1><p className="text-xs text-muted-foreground">Read-only view of the app&apos;s real role gating</p></div>
        <div className="flex flex-wrap items-end gap-xs">
          <div><label className="mb-0.5 block text-xs text-muted-foreground">Role</label><Select value={selected} onValueChange={(v) => setSelected(v as UserRole)}><SelectTrigger aria-label="Role" className="h-8 w-48 text-sm"><SelectValue /></SelectTrigger><SelectContent>{allRoles.map((r) => <SelectItem key={r} value={r}>{roleLabels[r]}</SelectItem>)}</SelectContent></Select></div>
          <div><label className="mb-0.5 block text-xs text-muted-foreground">Compare with</label><Select value={compareWith || "none"} onValueChange={(v) => setCompareWith(v === "none" ? "" : v as UserRole)}><SelectTrigger aria-label="Compare role" className="h-8 w-48 text-sm"><SelectValue placeholder="None" /></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem>{allRoles.filter((r) => r !== selected).map((r) => <SelectItem key={r} value={r}>{roleLabels[r]}</SelectItem>)}</SelectContent></Select></div>
        </div>
      </div>

      {cmp ? (
        <div className="flex flex-col gap-sm">
          <p className="flex items-center gap-1 text-sm font-semibold text-foreground"><GitCompare className="size-4" /> {roleLabels[selected]} vs {roleLabels[compareWith as UserRole]}</p>
          <div className="grid grid-cols-1 gap-sm lg:grid-cols-3">
            <CompareCol title={`Only ${roleLabels[selected]}`} items={cmp.onlyA} tone="text-success" />
            <CompareCol title="Shared" items={cmp.shared} tone="text-muted-foreground" />
            <CompareCol title={`Only ${roleLabels[compareWith as UserRole]}`} items={cmp.onlyB} tone="text-info" />
          </div>
          <Button size="sm" variant="ghost" onClick={() => setCompareWith("")}>Back to matrix</Button>
        </div>
      ) : (
        <PermissionMatrix role={selected} />
      )}
    </div>
  );
}

function CompareCol({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-sm">
      <p className="mb-sm text-sm font-medium text-foreground">{title} <span className="text-xs text-muted-foreground">({items.length})</span></p>
      <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
        {items.map((i) => <span key={i} className={`text-xs ${tone}`}>{i}</span>)}
        {items.length === 0 && <span className="text-xs text-muted-foreground">None</span>}
      </div>
    </div>
  );
}

export default function PermissionsPage() {
  return <Suspense fallback={<div className="p-md text-sm text-muted-foreground">Loading…</div>}><PermissionsInner /></Suspense>;
}
