"use client";

import { BookOpen, Library, Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PermissionDenied } from "@/components/library/permission-denied";
import { ResourceAuditTrail } from "@/components/library/resource-audit-trail";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { memberTypeLabels, resourceTypeLabels } from "@/lib/types/library";
import { formatMoney } from "@/lib/finance/money";

export default function LibrarySettingsPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  if (!can("library.manageSettings") && !can("library.view")) return <PermissionDenied action="view library settings" role={roleLabels[role]} />;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Library settings</h1>
        <p className="text-xs text-muted-foreground">Libraries, lending policies and configuration</p>
      </div>

      <section className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm flex items-center gap-1 text-sm font-semibold text-foreground">
          <Library className="size-4" /> Libraries
        </h2>
        <div className="flex flex-col gap-sm">
          {db.libraries.map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm">
              <div>
                <p className="text-sm font-medium text-foreground">{l.name} <span className="text-xs text-muted-foreground">({l.code})</span></p>
                <p className="text-xs text-muted-foreground">{l.location} · {l.openingHours ?? "—"}</p>
              </div>
              {l.isPrimary && <Badge tone="info">Primary</Badge>}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm flex items-center gap-1 text-sm font-semibold text-foreground">
          <Settings2 className="size-4" /> Lending policies
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="py-sm pr-sm font-semibold">Policy</th>
                <th className="py-sm pr-sm font-semibold">Applies to</th>
                <th className="py-sm pr-sm text-right font-semibold">Max books</th>
                <th className="py-sm pr-sm text-right font-semibold">Duration</th>
                <th className="py-sm pr-sm text-right font-semibold">Renewals</th>
                <th className="py-sm pr-sm text-right font-semibold">Fine/day</th>
                <th className="py-sm text-right font-semibold">Max fine</th>
              </tr>
            </thead>
            <tbody>
              {db.libraryRules.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="py-sm pr-sm font-medium text-foreground">{r.name}</td>
                  <td className="py-sm pr-sm text-muted-foreground">{r.memberType ? memberTypeLabels[r.memberType] : r.resourceType ? resourceTypeLabels[r.resourceType] : "Everyone"}</td>
                  <td className="py-sm pr-sm text-right text-foreground">{r.maxBooks}</td>
                  <td className="py-sm pr-sm text-right text-foreground">{r.loanDurationDays}d</td>
                  <td className="py-sm pr-sm text-right text-foreground">{r.renewalCount}</td>
                  <td className="py-sm pr-sm text-right text-foreground">{formatMoney(r.finePerDay)}</td>
                  <td className="py-sm text-right text-foreground">{formatMoney(r.maxFine)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm flex items-center gap-1 text-sm font-semibold text-foreground">
          <BookOpen className="size-4" /> Recent library activity
        </h2>
        <ResourceAuditTrail domain="library" />
      </section>
    </div>
  );
}
