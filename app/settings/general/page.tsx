"use client";

import Link from "next/link";
import { Sliders } from "lucide-react";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useAdmin } from "@/lib/hooks/use-admin";
import { roleLabels } from "@/lib/permissions/roles";

export default function GeneralSettingsPage() {
  const { role } = usePermissions();
  const admin = useAdmin();
  const canView = role === "super-admin" || role === "administrator" || role === "principal";
  if (!canView) return <PermissionDenied action="view general settings" role={roleLabels[role]} backHref="/settings" />;

  const rows = [
    { label: "School", value: admin.schoolProfile.name, href: "/settings/school" },
    { label: "Active session", value: admin.sessions.find((s) => s.status === "active")?.name ?? "—", href: "/settings/academic-sessions" },
    { label: "Branches", value: `${admin.branches.length} configured`, href: "/settings/branches" },
    { label: "Default language", value: admin.localization.enabledLanguages.find((l) => l.code === admin.localization.defaultLanguage)?.label ?? admin.localization.defaultLanguage, href: "/settings/localization" },
    { label: "Currency", value: admin.localization.currency, href: "/settings/regional" },
    { label: "Time zone", value: admin.regional.timeZone, href: "/settings/regional" },
    { label: "Theme", value: admin.theme.schoolTheme, href: "/settings/themes" },
    { label: "Enabled modules", value: `${admin.modules.filter((m) => m.enabled).length}/${admin.modules.length}`, href: "/settings/modules" },
  ];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><Sliders className="size-5 text-primary" /> General</h1><p className="text-xs text-muted-foreground">Organisation preferences at a glance</p></div>
      <div className="rounded-lg border border-border bg-surface">
        {rows.map((r, i) => (
          <Link key={r.label} href={r.href} className={`flex items-center justify-between gap-sm p-sm text-sm transition hover:bg-surface-secondary/40 ${i > 0 ? "border-t border-border" : ""}`}>
            <span className="text-muted-foreground">{r.label}</span>
            <span className="flex items-center gap-2 text-foreground">{r.value} <span className="text-primary">→</span></span>
          </Link>
        ))}
      </div>
    </div>
  );
}
