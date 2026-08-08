"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, Search, Settings as SettingsIcon } from "lucide-react";
import { allSettingsItems, settingsNav } from "@/components/settings/settings-nav";
import { cn } from "@/lib/utils";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return allSettingsItems.filter((i) => i.label.toLowerCase().includes(q) || i.category.toLowerCase().includes(q) || (i.keywords ?? []).some((k) => k.includes(q))).slice(0, 8);
  }, [query]);

  const isActive = (href: string) => pathname === href;

  return (
    <div className="flex flex-col gap-md lg:grid lg:grid-cols-[248px_minmax(0,1fr)] lg:items-start lg:gap-lg">
      {/* Sidebar rail (desktop) + collapsible (mobile) */}
      <nav className="lg:sticky lg:top-4" aria-label="Settings navigation">
        {/* Settings search */}
        <div className="relative mb-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search settings…" aria-label="Search settings" className="w-full rounded-md border border-border bg-surface py-1.5 pl-8 pr-3 text-sm text-foreground outline-none focus:border-primary" />
          {results.length > 0 && (
            <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-border bg-surface shadow-lg">
              {results.map((r) => (
                <Link key={r.href} href={r.href} onClick={() => setQuery("")} className="flex items-center justify-between gap-2 px-3 py-2 text-sm text-foreground hover:bg-surface-secondary/60">
                  <span className="flex items-center gap-2"><r.icon className="size-3.5 text-muted-foreground" /> {r.label}</span>
                  <span className="text-xs text-muted-foreground">{r.category}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Mobile category toggle */}
        <button type="button" onClick={() => setMobileOpen((o) => !o)} className="mb-sm flex w-full items-center justify-between rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground lg:hidden">
          <span className="flex items-center gap-2"><SettingsIcon className="size-4" /> All settings</span>
          <ChevronDown className={cn("size-4 transition", mobileOpen && "rotate-180")} />
        </button>

        <div className={cn("flex-col gap-md rounded-lg border border-border bg-surface p-sm", mobileOpen ? "flex" : "hidden", "lg:flex")}>
          <Link href="/settings" className={cn("rounded-md px-2 py-1.5 text-sm font-semibold", pathname === "/settings" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-surface-secondary/60")} onClick={() => setMobileOpen(false)}>Command Centre</Link>
          {settingsNav.map((cat) => (
            <div key={cat.key}>
              <p className="mb-1 flex items-center gap-1.5 px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"><cat.icon className="size-3.5" /> {cat.label}</p>
              <div className="flex flex-col">
                {cat.items.map((item) => (
                  <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className={cn("rounded-md px-2 py-1.5 text-sm transition", isActive(item.href) ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-surface-secondary/60 hover:text-foreground")} aria-current={isActive(item.href) ? "page" : undefined}>
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </nav>

      <div className="min-w-0">{children}</div>
    </div>
  );
}
