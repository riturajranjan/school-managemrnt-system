"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Building2, ChevronDown, Command } from "lucide-react";
import { saasNav } from "@/components/super-admin/saas-nav";
import { GlobalSearch } from "@/components/super-admin/global-search";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { roleLabels } from "@/lib/permissions/roles";
import { cn } from "@/lib/utils";

const PLATFORM_NAME = "Novyra Campus OS";

export default function SuperAdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { role, isPlatformAdmin, capabilitiesLoading } = usePermissions();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Super Admin workspace is gated to real platform admins (server also enforces
  // this in the root layout). Wait for capabilities so we don't flash "denied".
  if (capabilitiesLoading) return null;
  if (!isPlatformAdmin) return <div className="p-md"><PermissionDenied action="access the SaaS control center" role={roleLabels[role]} backHref="/" /></div>;

  const isActive = (href: string) => pathname === href || (href !== "/super-admin" && pathname.startsWith(`${href}/`));

  return (
    <div className="flex flex-col gap-md">
        {/* Workspace identity header */}
        <div className="flex flex-col gap-sm rounded-xl border border-border bg-[linear-gradient(135deg,#022c43,#0a3a52)] p-sm text-white sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-lg bg-white/15"><Command className="size-5" /></span>
            <div><p className="text-sm font-bold leading-tight">SaaS Control Center</p><p className="text-[11px] text-white/70">{PLATFORM_NAME} · Platform administration</p></div>
          </div>
          <GlobalSearch />
        </div>

        <div className="lg:grid lg:grid-cols-[224px_minmax(0,1fr)] lg:items-start lg:gap-lg">
          <nav className="mb-md lg:mb-0 lg:sticky lg:top-4" aria-label="Super Admin navigation">
            <button type="button" onClick={() => setMobileOpen((o) => !o)} className="mb-sm flex w-full items-center justify-between rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground lg:hidden">
              <span className="flex items-center gap-2"><Building2 className="size-4" /> Platform menu</span><ChevronDown className={cn("size-4 transition", mobileOpen && "rotate-180")} />
            </button>
            <div className={cn("flex-col gap-md rounded-lg border border-border bg-surface p-sm", mobileOpen ? "flex" : "hidden", "lg:flex")}>
              {saasNav.map((g) => (
                <div key={g.key}>
                  <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{g.label}</p>
                  <div className="flex flex-col">
                    {g.items.map((item) => (
                      <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} aria-current={isActive(item.href) ? "page" : undefined} className={cn("flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition", isActive(item.href) ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-surface-secondary/60 hover:text-foreground")}>
                        <item.icon className="size-3.5 shrink-0" /> {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </nav>
          <div className="min-w-0">{children}</div>
        </div>
      </div>
  );
}
