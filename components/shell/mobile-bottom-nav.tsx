"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { mobileBottomNavItems } from "./nav-config";
import { useShell } from "./shell-context";

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

// Fixed 5-tab bottom nav: 4 primary destinations + "More" (opens MobileMoreSheet).
export function MobileBottomNav() {
  const pathname = usePathname();
  const { mobileMoreOpen, setMobileMoreOpen } = useShell();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 flex h-[calc(var(--mobile-bottom-nav-height)_+_env(safe-area-inset-bottom))] border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm md:hidden"
    >
      {mobileBottomNavItems.map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors ${
              active ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <Icon className="size-5" aria-hidden="true" />
            <span>{item.label}</span>
          </Link>
        );
      })}
      <button
        type="button"
        onClick={() => setMobileMoreOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={mobileMoreOpen}
        className={`flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors ${
          mobileMoreOpen ? "text-primary" : "text-muted-foreground"
        }`}
      >
        <Menu className="size-5" aria-hidden="true" />
        <span>More</span>
      </button>
    </nav>
  );
}
