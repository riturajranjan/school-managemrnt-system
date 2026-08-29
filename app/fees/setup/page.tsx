"use client";

// UX simplification pass — groups the fee-configuration pages (categories,
// structures, assignments, discounts, scholarships, late fees) behind one
// "Fee Setup" hub so the main Fees landing page doesn't have to expose every
// configuration module as an equal top-level card. Pure navigation grouping:
// no new data, calculation or permission — reuses the same fees.manage gate
// every one of these pages already enforces individually.
import Link from "next/link";
import { AlertTriangle, ClipboardList, Coins, FileStack, Scale, Settings, Tags } from "lucide-react";
import { FeeTrail } from "@/components/fees/fee-trail";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useFeeStructures } from "@/lib/hooks/api/use-fees-api";
import { roleLabels } from "@/lib/permissions/roles";

export default function FeeSetupPage() {
  const { can, hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const canManage = can("fees.manage");
  const { data: structures, loading: structuresLoading } = useFeeStructures();

  if (!capabilitiesLoading && !hasServerPermission("fees.view")) return <PermissionDenied action="view the fees module" role={roleLabels[role]} backHref="/fees" />;

  if (!capabilitiesLoading && !canManage) {
    return (
      <div className="flex flex-col items-center gap-sm py-2xl text-center">
        <Settings className="size-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">You don&apos;t have permission to configure fees.</p>
      </div>
    );
  }

  const hasStructures = structuresLoading || (structures?.length ?? 0) > 0;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <FeeTrail items={[{ label: "Fees", href: "/fees" }, { label: "Fee Setup" }]} />

      <div>
        <h1 className="text-lg font-semibold text-foreground">Fee Setup</h1>
        <p className="text-xs text-muted-foreground">Start here when setting fees for a new academic session.</p>
      </div>

      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
        <Link href="/fees/categories" className="surface-3d flex items-start gap-sm rounded-lg border border-border bg-surface p-md outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:-translate-y-0.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Tags className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Fee Types</p>
            <p className="text-xs text-muted-foreground">The types of fees your school charges — tuition, transport, exam fee, etc.</p>
          </div>
        </Link>

        <Link href="/fees/structures" className="surface-3d flex items-start gap-sm rounded-lg border border-border bg-surface p-md outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:-translate-y-0.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <FileStack className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Fee Structure</p>
            <p className="text-xs text-muted-foreground">Set fees for each class and academic session.</p>
          </div>
        </Link>

        {hasStructures ? (
          <Link href="/fees/assignments" className="surface-3d flex items-start gap-sm rounded-lg border border-border bg-surface p-md outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:-translate-y-0.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <ClipboardList className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Assign Fees to Students</p>
              <p className="text-xs text-muted-foreground">Choose which students should receive this fee.</p>
            </div>
          </Link>
        ) : (
          <div className="flex items-start gap-sm rounded-lg border border-dashed border-border bg-surface p-md">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-secondary text-muted-foreground">
              <AlertTriangle className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Assign Fees to Students</p>
              <p className="text-xs text-muted-foreground">Create a fee structure first.</p>
              <Link href="/fees/structures/new" className="mt-1 inline-block text-xs font-medium text-primary hover:underline">
                Create Fee Structure
              </Link>
            </div>
          </div>
        )}

        <div className="surface-3d flex items-start gap-sm rounded-lg border border-border bg-surface p-md">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Coins className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Discounts &amp; Scholarships</p>
            <p className="text-xs text-muted-foreground">Give a discount or award a scholarship on a student&apos;s fees.</p>
            <div className="mt-1.5 flex gap-sm text-xs font-medium">
              <Link href="/fees/discounts" className="text-primary hover:underline">
                Discounts
              </Link>
              <Link href="/fees/scholarships" className="text-primary hover:underline">
                Scholarships
              </Link>
            </div>
          </div>
        </div>

        <Link href="/fees/fines" className="surface-3d flex items-start gap-sm rounded-lg border border-border bg-surface p-md outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:-translate-y-0.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Scale className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Late Fee Rules</p>
            <p className="text-xs text-muted-foreground">Set extra charges for late payments.</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
