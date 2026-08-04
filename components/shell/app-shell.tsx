import type { ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AiCommandDialog } from "./ai-command";
import { CommandPaletteDialog } from "./command-palette";
import { Header } from "./header";
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

export function AppShell({ children }: { children: ReactNode }) {
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

        <div className="flex h-dvh w-full overflow-hidden bg-background">
          <Sidebar />
          <TabletDrawer />

          {/* min-w-0 lets this column shrink below its content's intrinsic width instead of forcing the page to overflow horizontally. */}
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <Header />
            <MobileHeader />

            <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto overflow-x-hidden outline-none">
              <PageTransition>
                <div className="w-full px-md py-md pb-[calc(var(--mobile-bottom-nav-height)_+_env(safe-area-inset-bottom)_+_1rem)] sm:px-lg sm:py-lg md:pb-lg">
                  {children}
                </div>
              </PageTransition>
            </main>
          </div>
        </div>

        <MobileBottomNav />
        <MobileMoreSheet />
        <MobileFab />
        <MobileContextSheet />
        <MobileSearchScreen />
        <CommandPaletteDialog />
        <AiCommandDialog />
        <NotificationCenter />
      </TooltipProvider>
    </ShellProvider>
  );
}
