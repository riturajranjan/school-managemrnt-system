"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight, Blocks, Building2, CheckCircle2, Circle, Database, Globe, Mail, Palette, ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { systemReadiness } from "@/lib/selectors/admin-brief";
import { roleLabels } from "@/lib/permissions/roles";

const CATEGORIES = [
  { label: "Organization", href: "/settings/school", icon: Building2, desc: "Profile, branches, general" },
  { label: "Academics", href: "/settings/academic-sessions", icon: Globe, desc: "Sessions & structure" },
  { label: "Users & Access", href: "/users", icon: Users, desc: "Users, roles, permissions" },
  { label: "Branding", href: "/settings/branding", icon: Palette, desc: "Colours, theme, logos" },
  { label: "Communication", href: "/settings/notifications", icon: Mail, desc: "Notifications & integrations" },
  { label: "Localization", href: "/settings/localization", icon: Globe, desc: "Language, region, numbering" },
  { label: "Integrations", href: "/settings/integrations", icon: Blocks, desc: "Payments, GPS, storage" },
  { label: "Security", href: "/settings/security", icon: ShieldCheck, desc: "Policies & audit log" },
  { label: "Data & System", href: "/settings/data", icon: Database, desc: "Import, backups, health" },
];

export default function SettingsCommandCentre() {
  const db = useSisStore();
  const { can, role, hasServerPermission } = usePermissions();
  const readiness = useMemo(() => systemReadiness(db), [db]);

  // Everyone with any settings-ish access can view; deny only truly restricted roles.
  const canView = can("documents.view") || can("hr.view") || can("fees.view") || hasServerPermission("settings.view");
  if (!canView) return <PermissionDenied action="view settings" role={roleLabels[role]} backHref="/" />;

  const R = 52, C = 2 * Math.PI * R;
  const offset = C - (readiness.percent / 100) * C;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Settings</h1>
        <p className="text-xs text-muted-foreground">System configuration · viewing as {roleLabels[role]}</p>
      </div>

      {/* System Readiness — dimensional ring + layered checklist */}
      <section className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">System Readiness</h2>
        <div className="grid grid-cols-1 gap-md lg:grid-cols-[200px_minmax(0,1fr)]">
          <div className="flex flex-col items-center justify-center">
            <div className="relative">
              <svg width="140" height="140" viewBox="0 0 140 140" className="-rotate-90">
                <circle cx="70" cy="70" r={R} fill="none" stroke="var(--color-border, #e2e8f0)" strokeWidth="10" />
                <circle cx="70" cy="70" r={R} fill="none" stroke="url(#readiness-grad)" strokeWidth="10" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={offset} />
                <defs><linearGradient id="readiness-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#022c43" /><stop offset="100%" stopColor="#18b0c8" /></linearGradient></defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-2xl font-bold text-foreground">{readiness.percent}%</span><span className="text-[10px] text-muted-foreground">ready</span></div>
            </div>
            <p className="mt-sm text-center text-xs text-muted-foreground">{readiness.completed}/{readiness.total} areas complete</p>
          </div>

          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {readiness.checks.map((c) => (
              <Link key={c.key} href={c.href} className="flex items-center gap-2 rounded-md border border-border p-2 text-sm transition hover:border-primary/40">
                {c.done ? <CheckCircle2 className="size-4 shrink-0 text-success" /> : <Circle className="size-4 shrink-0 text-warning" />}
                <span className="min-w-0"><span className="block truncate text-foreground">{c.label}</span><span className="block truncate text-xs text-muted-foreground">{c.hint}</span></span>
              </Link>
            ))}
          </div>
        </div>
        {readiness.nextStep && (
          <div className="mt-sm flex items-center justify-between gap-sm rounded-md border border-primary/25 bg-primary/5 p-sm text-sm">
            <span className="text-primary">Recommended next: <span className="font-medium">{readiness.nextStep.label}</span></span>
            <Button asChild size="sm"><Link href={readiness.nextStep.href}>Configure <ArrowRight className="size-3.5" /></Link></Button>
          </div>
        )}
      </section>

      {/* Setup categories */}
      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2 lg:grid-cols-3">
        {CATEGORIES.map((c) => (
          <Link key={c.label} href={c.href} className="surface-3d flex items-center gap-sm rounded-lg border border-border bg-surface p-md transition hover:border-primary/40">
            <span className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary"><c.icon className="size-5" /></span>
            <div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{c.label}</p><p className="truncate text-xs text-muted-foreground">{c.desc}</p></div>
          </Link>
        ))}
      </div>

      <p className="rounded-md border border-border bg-surface-secondary/40 p-sm text-xs text-muted-foreground">All settings are a frontend simulation over typed mock state — nothing here is persisted to a backend, and no integrations are actually connected.</p>
    </div>
  );
}
