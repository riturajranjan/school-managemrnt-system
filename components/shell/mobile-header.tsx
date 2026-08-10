"use client";

import { ChevronDown, Search } from "lucide-react";
import { usePathname } from "next/navigation";
import { getBreadcrumb } from "./nav-config";
import { NotificationTrigger } from "./notification-trigger";
import { useShell } from "./shell-context";
import { UserMenu } from "./user-menu";
import { mobileIconButtonClass } from "./styles";

// Compact, single-row mobile header: only essential icons (search,
// notifications, avatar). School/branch/session selectors live in the
// context sheet, opened by tapping the logo/title area.
//
// In PLATFORM context the title is static (no school/branch/session context
// sheet) and the school search is omitted — the SaaS control center provides its
// own "Platform menu" and search.
export function MobileHeader({ platform = false }: { platform?: boolean }) {
  const pathname = usePathname();
  const { pageLabel } = getBreadcrumb(pathname);
  const { setMobileContextSheetOpen, setMobileSearchOpen } = useShell();
  const title = platform ? "SaaS Control Center" : pageLabel;

  return (
    <header className="flex h-[calc(var(--mobile-header-height)_+_env(safe-area-inset-top))] shrink-0 items-center gap-sm border-b border-border bg-surface/90 px-sm pt-[env(safe-area-inset-top)] backdrop-blur-sm md:hidden print:hidden">
      {platform ? (
        <div className="flex min-h-11 min-w-0 flex-1 items-center gap-sm px-xs">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-sidebar-gradient text-xs font-bold text-sidebar-foreground" aria-hidden="true">
            N
          </span>
          <span className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-foreground">{title}</span>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setMobileContextSheetOpen(true)}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-sm rounded-lg px-xs outline-none transition-colors hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`${pageLabel}. Switch school, branch, or academic session`}
        >
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-md bg-sidebar-gradient text-xs font-bold text-sidebar-foreground"
            aria-hidden="true"
          >
            N
          </span>
          {/* Not a heading: the page's real <h1> lives in the page content below.
              The button's aria-label already carries this text for a11y — this
              span is the visual label only, so the document keeps exactly one h1. */}
          <span className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-foreground" aria-hidden="true">
            {pageLabel}
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
      )}
      <div className="flex shrink-0 items-center gap-1">
        {!platform && (
          <button
            type="button"
            onClick={() => setMobileSearchOpen(true)}
            className={mobileIconButtonClass}
            aria-label="Search"
          >
            <Search className="size-4" aria-hidden="true" />
          </button>
        )}
        <NotificationTrigger variant="mobile" />
        <UserMenu variant="mobile" />
      </div>
    </header>
  );
}
