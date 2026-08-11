"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AiCommandDialog } from "./ai-command";
import { CommandPaletteDialog } from "./command-palette";
import { Header } from "./header";
import { ImpersonationBanner } from "./impersonation-banner";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { MobileContextSheet } from "./mobile-context-sheet";
import { MobileFab } from "./mobile-fab";
import { MobileHeader } from "./mobile-header";
import { MobileMoreSheet } from "./mobile-more-sheet";
import { MobileSearchScreen } from "./mobile-search-screen";
import { NotificationCenter } from "./notification-center";
import { PageTransition } from "./page-transition";
import { ShellProvider } from "./shell-context";
import { Sidebar } from "./sidebar";
import { TabletDrawer } from "./tablet-drawer";

// Auth / full-screen routes render outside the authenticated dashboard chrome
// (no sidebar, header or mobile nav). The (auth) route group provides its own
// layout for these paths.
const FULLSCREEN_PREFIXES = [
  "/login", "/forgot-password", "/reset-password", "/verify", "/verify-email", "/verify-otp",
  "/activate-account", "/accept-invite", "/setup-password", "/first-login",
  "/access-denied", "/account-locked", "/session-expired", "/maintenance", "/offline",
  "/select-school", "/select-role", "/select-branch", "/select-session", "/select-child",
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isFullscreen = FULLSCREEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  // PLATFORM context = the SaaS control center. A platform admin has no school
  // context, so the school sidebar, branch/session switchers and school-scoped
  // mobile nav are suppressed; the /super-admin layout supplies platform nav.
  // (Server-side, requirePlatformAdmin already gates these routes.)
  const isPlatform = pathname === "/super-admin" || pathname.startsWith("/super-admin/");

  if (isFullscreen) return <>{children}</>;

  return (
    <ShellProvider>
      <TooltipProvider delayDuration={200} skipDelayDuration={100}>
        {/* Keyboard users would otherwise tab through the full sidebar nav
            (and header controls) on every page before reaching content. */}
        <a
          href="#main-content"
          className="sr-only rounded-md bg-primary px-md py-sm text-sm font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50"
        >
          Skip to main content
        </a>

        <div className="flex h-dvh w-full overflow-hidden bg-background print:h-auto print:overflow-visible">
          {!isPlatform && <Sidebar />}
          {!isPlatform && <TabletDrawer />}

          {/* min-w-0 lets this column shrink below its content's intrinsic width instead of forcing the page to overflow horizontally.
              relative z-10: the sidebar's lg: 3D transform (rotateY/translateZ, see sidebar.tsx) opens its own compositing layer,
              and its rightward shadow-[8px_0_32px...] can bleed a sliver onto this column's left edge in some browsers unless this
              column has an explicit, higher stacking context to reliably paint above it — this is what was read as the header
              "clipping" at lg+ widths. */}
          <div className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden print:overflow-visible">
            {/* App-wide: shown in BOTH platform and school context while inspecting. */}
            <ImpersonationBanner />
            <Header platform={isPlatform} />
            <MobileHeader platform={isPlatform} />

            <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto overflow-x-hidden outline-none print:overflow-visible">
              <PageTransition>
                <div className="w-full px-md py-md pb-[calc(var(--mobile-bottom-nav-height)_+_env(safe-area-inset-bottom)_+_1rem)] sm:px-lg sm:py-lg md:pb-lg print:p-0">
                  {children}
                </div>
              </PageTransition>
            </main>
          </div>
        </div>

        {/* School-scoped mobile nav + command surfaces — omitted in platform context. */}
        {!isPlatform && <MobileBottomNav />}
        {!isPlatform && <MobileMoreSheet />}
        {!isPlatform && <MobileFab />}
        {!isPlatform && <MobileContextSheet />}
        {!isPlatform && <MobileSearchScreen />}
        {!isPlatform && <CommandPaletteDialog />}
        {!isPlatform && <AiCommandDialog />}
        <NotificationCenter />
      </TooltipProvider>
    </ShellProvider>
  );
}
