"use client";

import type { CSSProperties } from "react";
import { PanelLeftClose, PanelLeftOpen, PanelsTopLeft } from "lucide-react";
import { SchoolSwitcher } from "./school-switcher";
import { NavGroup } from "./nav-group";
import { useVisibleNavGroups } from "./use-nav-access";
import { useShell } from "./shell-context";
import { UserMenu } from "./user-menu";
import { WorkspaceStatus } from "./workspace-status";

// Small circular glass control shared by the collapse toggle and the
// tablet-rail "open full menu" trigger — dark elevated surface, thin border,
// muted icon, cyan on hover. Never a bright/filled button (item 4).
const railButtonClass =
  "flex size-8 shrink-0 items-center justify-center rounded-full border border-sidebar-border bg-sidebar-surface-elevated text-sidebar-text-muted outline-none transition-colors duration-150 hover:border-sidebar-active-border hover:text-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-accent/70";

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebarCollapsed, setTabletDrawerOpen } = useShell();
  const navGroups = useVisibleNavGroups();

  const widthStyle = {
    "--current-sidebar-width": sidebarCollapsed ? "var(--sidebar-width-collapsed)" : "var(--sidebar-width)",
  } as CSSProperties;

  return (
    <div
      style={widthStyle}
      className="hidden shrink-0 md:block md:w-(--sidebar-width-collapsed) lg:w-(--current-sidebar-width) lg:[perspective:1800px] transition-[width] duration-200 ease-out print:hidden"
    >
      {/* Outer layer carries shape + shadow; a shadow on the same box that also
          clips (overflow-hidden, for the mesh) would itself get clipped. */}
      <aside
        className="relative h-full rounded-r-xl shadow-[8px_0_32px_-8px_rgba(2,10,20,0.55)] lg:[transform:rotateY(0.6deg)_translateZ(0)]"
        aria-label="Primary navigation"
      >
        <div className="relative flex h-full flex-col overflow-hidden rounded-r-xl border-r border-sidebar-border/60 bg-sidebar-gradient text-sidebar-foreground">
          <div aria-hidden className="sidebar-mesh pointer-events-none absolute inset-0" />

          <div className="relative z-10 flex h-full flex-col">
            {/* Brand — wordmark + collapse control on the opposite edge. Grows
                vertically (no fixed height) so it can stack in collapsed rail. */}
            <div
              className={`flex shrink-0 items-center gap-sm px-md py-sm ${
                sidebarCollapsed ? "flex-col justify-center gap-xs" : "justify-between"
              }`}
            >
              <div className="flex min-w-0 items-center gap-sm">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-sidebar-border bg-sidebar-surface-elevated text-sm font-bold text-sidebar-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                  N
                </span>
                <span className={`min-w-0 flex-col leading-tight ${sidebarCollapsed ? "hidden" : "hidden lg:flex"}`}>
                  <span className="truncate text-[15px] font-semibold tracking-tight text-sidebar-text">Novyra</span>
                  <span className="truncate text-[10px] font-semibold uppercase tracking-[0.1em] text-sidebar-accent/85">
                    Campus OS
                  </span>
                </span>
              </div>

              <button
                type="button"
                onClick={toggleSidebarCollapsed}
                className={`${railButtonClass} hidden lg:flex`}
                aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {sidebarCollapsed ? (
                  <PanelLeftOpen className="size-4" aria-hidden="true" />
                ) : (
                  <PanelLeftClose className="size-4" aria-hidden="true" />
                )}
              </button>
            </div>

            {/* School switcher + sync status — one glass command card. Hidden in
                rail mode (tablet, or desktop-collapsed) where there's no room. */}
            <div className={`px-sm pb-sm ${sidebarCollapsed ? "hidden" : "hidden lg:block"}`}>
              <div className="rounded-lg border border-sidebar-border bg-sidebar-surface/70 px-2 py-1.5 shadow-[0_0_24px_-16px_var(--sidebar-active-glow)]">
                <SchoolSwitcher variant="sidebar" />
                <WorkspaceStatus />
              </div>
            </div>

            {/* Tablet-only: rail tap target that opens the full nav as an overlay drawer. */}
            <button
              type="button"
              onClick={() => setTabletDrawerOpen(true)}
              className={`${railButtonClass} mx-auto mb-xs lg:hidden`}
              aria-label="Open navigation menu"
            >
              <PanelsTopLeft className="size-4" aria-hidden="true" />
            </button>

            <div className="mx-sm h-px bg-sidebar-border-muted" />

            <nav className="sidebar-nav-scrollbar flex flex-1 flex-col gap-xs overflow-y-auto px-sm pt-sm pb-md" aria-label="Sections">
              {navGroups.map((group, index) => (
                <div key={group.key}>
                  {index > 0 && <div className="mx-sm mb-xs h-px bg-sidebar-border-muted" />}
                  <NavGroup group={group} collapsed={sidebarCollapsed} layoutScope="sidebar" defaultOpen />
                </div>
              ))}
            </nav>

            {/* shadow-[0_-8px...] gives the scrollable nav above a soft "content continues under here" fade instead of a hard-stop border alone. */}
            <div className="relative mt-auto flex flex-col border-t border-sidebar-border-muted px-sm py-sm shadow-[0_-8px_12px_-8px_rgba(0,0,0,0.28)]">
              <UserMenu variant="sidebar" collapsed={sidebarCollapsed} />
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
