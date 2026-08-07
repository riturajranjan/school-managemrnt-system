"use client";

import Link from "next/link";
import { AlertTriangle, ClipboardList, HardDrive, ScrollText, ShieldCheck, TrendingDown, Trash2, Users, Wrench } from "lucide-react";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { assetSummary } from "@/lib/selectors/asset-brief";
import { roleLabels } from "@/lib/permissions/roles";
import { formatMoney } from "@/lib/finance/money";

const quickLinks = [
  { href: "/assets/register", label: "Register", description: "Full fixed-asset register", icon: HardDrive },
  { href: "/assets/assignments", label: "Assignments", description: "Who holds what, handover tracking", icon: Users },
  { href: "/assets/maintenance", label: "Maintenance", description: "Preventive and repair schedule", icon: Wrench },
  { href: "/assets/depreciation", label: "Depreciation", description: "Book value and schedules", icon: TrendingDown },
  { href: "/assets/disposal", label: "Disposal", description: "Controlled retirement workflow", icon: Trash2 },
  { href: "/assets/audit", label: "Audit", description: "Verification and history", icon: ShieldCheck },
  { href: "/assets/reports", label: "Reports", description: "Register, warranty and depreciation", icon: ScrollText },
];

export default function AssetsHubPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  if (!can("assets.view")) return <PermissionDenied action="view assets" role={roleLabels[role]} backHref="/" />;
  const summary = assetSummary(db);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Assets</h1>
        <p className="text-xs text-muted-foreground">Fixed-asset register, assignments, maintenance and depreciation</p>
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Total assets" value={String(summary.total)} icon={HardDrive} tone="neutral" />
        <StatTile label="Book value" value={formatMoney(summary.bookValue, { compact: true })} icon={ClipboardList} tone="neutral" />
        <StatTile label="Assigned" value={String(summary.assigned)} icon={Users} tone="success" />
        <StatTile label="Maintenance due" value={String(summary.maintenanceDue)} icon={AlertTriangle} tone={summary.maintenanceDue > 0 ? "warning" : "success"} />
      </div>

      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2 lg:grid-cols-3">
        {quickLinks.map(({ href, label, description, icon: Icon }) => (
          <Link key={href} href={href} className="surface-3d flex items-center gap-sm rounded-lg border border-border bg-surface p-md outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:-translate-y-0.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Icon className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{label}</p>
              <p className="truncate text-xs text-muted-foreground">{description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
