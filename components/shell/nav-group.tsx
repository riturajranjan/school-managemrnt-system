"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { NavLink } from "./nav-link";
import type { NavGroup as NavGroupType } from "./nav-config";

export function NavGroup({
  group,
  collapsed = false,
  variant = "rail",
  layoutScope = "sidebar",
  defaultOpen = true,
  onNavigate,
}: {
  group: NavGroupType;
  /** Desktop (lg+) rail-collapsed state. Ignored when variant="full". */
  collapsed?: boolean;
  /**
   * "rail": the persistent Sidebar — group header + collapse toggle only
   * render at lg (a tablet rail has no room for either), and items always
   * show flat below lg regardless of the group's open/closed state.
   * "full": overlays (tablet drawer, mobile sheet) — header and the collapse
   * toggle are always active, at any width.
   */
  variant?: "rail" | "full";
  layoutScope?: string;
  defaultOpen?: boolean;
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const full = variant === "full";
  const effectiveOpen = full ? open : collapsed ? true : open;

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={effectiveOpen}
        className={`${
          full ? "flex" : collapsed ? "hidden" : "hidden lg:flex"
        } min-h-8 items-center justify-between rounded-md px-md text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/50 outline-none transition-colors hover:text-sidebar-foreground/80 focus-visible:ring-2 focus-visible:ring-sidebar-foreground/60`}
      >
        <span>{group.label}</span>
        <ChevronDown
          className={`size-3.5 transition-transform duration-150 motion-reduce:transition-none ${open ? "" : "-rotate-90"}`}
          aria-hidden="true"
        />
      </button>

      {/* CSS-grid collapse (0fr -> 1fr). In rail mode the `lg:` prefix means
          the collapsed state only ever takes effect at the desktop
          breakpoint — a tablet rail or mobile sheet always shows every item
          regardless of `open`. In full mode it applies at any width, since
          the toggle is genuinely interactive there. */}
      <div
        data-state={effectiveOpen ? "open" : "closed"}
        className={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none grid-rows-[1fr] ${
          full ? "data-[state=closed]:grid-rows-[0fr]" : "lg:data-[state=closed]:grid-rows-[0fr]"
        }`}
      >
        <div className="flex flex-col gap-0.5 overflow-hidden">
          {group.items.map((item) => (
            <NavLink
              key={item.key}
              item={item}
              collapsed={collapsed}
              variant={variant}
              layoutScope={layoutScope}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
