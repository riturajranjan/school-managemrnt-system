"use client";

import type { CSSProperties } from "react";
import { PanelLeftClose, PanelLeftOpen, PanelsTopLeft } from "lucide-react";
import { SchoolSwitcher } from "./school-switcher";
import { navGroups } from "./nav-config";
import { NavGroup } from "./nav-group";
import { useShell } from "./shell-context";
import { UserMenu } from "./user-menu";
import { WorkspaceStatus } from "./workspace-status";

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebarCollapsed, setTabletDrawerOpen } = useShell();

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
        <div className="relative flex h-full flex-col overflow-hidden rounded-r-xl bg-sidebar-gradient text-sidebar-foreground shadow-[inset_-1px_0_0_rgba(255,255,255,0.06),inset_0_1px_0_rgba(255,255,255,0.14)]">
          <div aria-hidden className="sidebar-mesh pointer-events-none absolute inset-0" />

          <div className="relative z-10 flex h-full flex-col">
            {/* Logo */}
            <div className="flex h-(--topbar-height) shrink-0 items-center gap-sm px-md">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/12 text-sm font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]">
                N
              </span>
              <span className={`truncate text-[15px] font-semibold tracking-tight ${sidebarCollapsed ? "hidden" : "hidden lg:inline"}`}>
                Novyra Campus OS
              </span>
            </div>

            {/* School switcher + workspace status — hidden in rail mode (tablet, or desktop-collapsed) */}
            <div className={`flex-col gap-xs px-sm pb-sm ${sidebarCollapsed ? "hidden" : "hidden lg:flex"}`}>
              <SchoolSwitcher variant="sidebar" />
              <WorkspaceStatus />
            </div>

            {/* Tablet-only: rail tap target that opens the full nav as an overlay drawer. */}
            <button
              type="button"
              onClick={() => setTabletDrawerOpen(true)}
              className="mx-sm mb-xs flex h-11 items-center justify-center gap-sm rounded-lg text-sidebar-foreground/70 transition-colors hover:bg-white/8 hover:text-sidebar-foreground lg:hidden"
              aria-label="Open navigation menu"
            >
              <PanelsTopLeft className="size-[18px]" aria-hidden="true" />
            </button>

            <div className="mx-sm h-px bg-sidebar-border/50" />

            <nav className="sidebar-nav-scrollbar flex flex-1 flex-col gap-xs overflow-y-auto px-sm pt-sm pb-md" aria-label="Sections">
              {navGroups.map((group, index) => (
                <div key={group.key}>
                  {index > 0 && <div className="mx-sm mb-xs h-px bg-sidebar-border/30" />}
                  <NavGroup group={group} collapsed={sidebarCollapsed} layoutScope="sidebar" defaultOpen />
                </div>
              ))}
            </nav>

            {/* shadow-[0_-8px...] gives the scrollable nav above a soft "content continues under here" fade instead of a hard-stop border alone. */}
            <div className="relative mt-auto flex flex-col gap-sm border-t border-sidebar-border/50 px-sm py-sm shadow-[0_-8px_12px_-8px_rgba(0,0,0,0.28)]">
              <UserMenu variant="sidebar" collapsed={sidebarCollapsed} />
              <button
                type="button"
                onClick={toggleSidebarCollapsed}
                className="hidden h-9 items-center justify-center gap-sm rounded-lg text-sidebar-foreground/70 transition-colors hover:bg-white/8 hover:text-sidebar-foreground lg:flex"
                aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {sidebarCollapsed ? (
                  <PanelLeftOpen className="size-[18px]" aria-hidden="true" />
                ) : (
                  <PanelLeftClose className="size-[18px]" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
