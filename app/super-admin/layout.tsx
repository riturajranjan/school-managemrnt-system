"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { Building2, ChevronDown, Command, Search } from "lucide-react";
import { saasNav } from "@/components/super-admin/saas-nav";
import { ImpersonationProvider } from "@/components/super-admin/impersonation";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSaas } from "@/lib/hooks/use-saas";
import { roleLabels } from "@/lib/permissions/roles";
import { cn } from "@/lib/utils";

export default function SuperAdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { role } = usePermissions();
  const saas = useSaas();
  const [query, setQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const r: { label: string; sub: string; href: string }[] = [];
    saas.tenants.forEach((t) => { if (t.name.toLowerCase().includes(q) || t.code.toLowerCase().includes(q) || t.domain.toLowerCase().includes(q)) r.push({ label: t.name, sub: `School · ${t.code}`, href: `/super-admin/schools/${t.id}` }); });
    saas.invoices.forEach((i) => { if (i.number.toLowerCase().includes(q)) r.push({ label: i.number, sub: "Invoice", href: "/super-admin/invoices" }); });
    saas.support.forEach((t) => { if (t.reference.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q)) r.push({ label: t.subject, sub: `Support · ${t.reference}`, href: `/super-admin/support/${t.id}` }); });
    saas.domains.forEach((d) => { if (d.domain.toLowerCase().includes(q)) r.push({ label: d.domain, sub: "Domain", href: "/super-admin/domains" }); });
    saas.admins.forEach((a) => { if (a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q)) r.push({ label: a.name, sub: "Admin user", href: "/super-admin/settings" }); });
    return r.slice(0, 8);
  }, [query, saas]);

  // Super Admin workspace is gated to the platform-level role.
  if (role !== "super-admin") return <div className="p-md"><PermissionDenied action="access the SaaS control center" role={roleLabels[role]} backHref="/" /></div>;

  const isActive = (href: string) => pathname === href || (href !== "/super-admin" && pathname.startsWith(`${href}/`));

  return (
    <ImpersonationProvider>
      <div className="flex flex-col gap-md">
        {/* Workspace identity header */}
        <div className="flex flex-col gap-sm rounded-xl border border-border bg-[linear-gradient(135deg,#022c43,#0a3a52)] p-sm text-white sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-lg bg-white/15"><Command className="size-5" /></span>
            <div><p className="text-sm font-bold leading-tight">SaaS Control Center</p><p className="text-[11px] text-white/70">{saas.settings.platformName} · Platform administration</p></div>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-white/60" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search schools, invoices, tickets…" aria-label="Global search" className="w-full rounded-md border border-white/20 bg-white/10 py-1.5 pl-8 pr-3 text-sm text-white placeholder:text-white/50 outline-none focus:border-white/50" />
            {results.length > 0 && (
              <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-md border border-border bg-surface text-foreground shadow-lg">
                {results.map((r, i) => <Link key={i} href={r.href} onClick={() => setQuery("")} className="flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-surface-secondary/60"><span className="truncate">{r.label}</span><span className="shrink-0 text-xs text-muted-foreground">{r.sub}</span></Link>)}
              </div>
            )}
          </div>
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
    </ImpersonationProvider>
  );
}
