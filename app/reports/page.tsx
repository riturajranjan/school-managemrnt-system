"use client";

import Link from "next/link";
import { Activity, BarChart3, Bus, ClipboardCheck, GraduationCap, HeartPulse, LifeBuoy, MessageSquare, Package, UtensilsCrossed, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { roleLabels, type Permission } from "@/lib/permissions/roles";

type ReportLink = { label: string; desc: string; href: string; icon: LucideIcon; perm: Permission };

const GROUPS: { title: string; items: ReportLink[] }[] = [
  {
    title: "Academics", items: [
      { label: "Attendance reports", desc: "Class, student & staff attendance trends", href: "/attendance/reports", icon: ClipboardCheck, perm: "attendance.viewAny" },
      { label: "Results & analytics", desc: "Performance analytics across exams", href: "/results/analytics", icon: GraduationCap, perm: "results.viewAnalytics" },
    ],
  },
  {
    title: "Finance", items: [
      { label: "Fee reports", desc: "Collection, dues & category breakdowns", href: "/fees/reports", icon: Wallet, perm: "fees.viewReports" },
      { label: "Accounting reports", desc: "Income, expense & ledger summaries", href: "/accounting/reports", icon: BarChart3, perm: "accounting.viewReports" },
    ],
  },
  {
    title: "Operations", items: [
      { label: "Transport reports", desc: "Routes, utilisation & incidents", href: "/transport/reports", icon: Bus, perm: "transport.viewReports" },
      { label: "Asset reports", desc: "Register, depreciation & disposal", href: "/assets/reports", icon: Package, perm: "assets.viewReports" },
      { label: "Cafeteria reports", desc: "Meal service & feedback", href: "/cafeteria/reports", icon: UtensilsCrossed, perm: "cafeteria.view" },
      { label: "Health reports", desc: "Infirmary workload & follow-ups", href: "/health/reports", icon: HeartPulse, perm: "health.view" },
    ],
  },
  {
    title: "Engagement", items: [
      { label: "Communication analytics", desc: "Reach & delivery of announcements", href: "/communication/analytics", icon: MessageSquare, perm: "comm.viewAnalytics" },
      { label: "Activities analytics", desc: "Participation & house standings", href: "/activities/analytics", icon: Activity, perm: "activities.viewAnalytics" },
      { label: "Helpdesk analytics", desc: "Ticket volume & resolution", href: "/helpdesk/analytics", icon: LifeBuoy, perm: "helpdesk.view" },
    ],
  },
];

export default function ReportsHubPage() {
  const { can, role } = usePermissions();
  const groups = GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => can(i.perm)) })).filter((g) => g.items.length > 0);

  if (groups.length === 0) return <PermissionDenied action="view reports" role={roleLabels[role]} backHref="/" />;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><BarChart3 className="size-5 text-primary" /> Reports</h1><p className="text-xs text-muted-foreground">Jump to module reports you have access to</p></div>
      {groups.map((g) => (
        <section key={g.title}>
          <h2 className="mb-sm text-sm font-semibold text-foreground">{g.title}</h2>
          <div className="grid grid-cols-1 gap-sm sm:grid-cols-2 lg:grid-cols-3">
            {g.items.map((i) => (
              <Link key={i.href} href={i.href} className="surface-3d flex items-center gap-sm rounded-lg border border-border bg-surface p-md transition hover:border-primary/40">
                <span className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary"><i.icon className="size-5" /></span>
                <span className="min-w-0"><span className="block truncate text-sm font-semibold text-foreground">{i.label}</span><span className="block truncate text-xs text-muted-foreground">{i.desc}</span></span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
