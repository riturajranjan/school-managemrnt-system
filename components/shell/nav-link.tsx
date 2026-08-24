"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useShell } from "./shell-context";
import type { NavItem } from "./nav-config";

const MotionLink = motion.create(Link);

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLink({
  item,
  collapsed = false,
  variant = "rail",
  /** Scopes the active-capsule shared layout animation to one surface (sidebar
   * rail vs. tablet drawer vs. mobile sheet) so it doesn't try to morph
   * between two simultaneously-mounted instances of the same item. */
  layoutScope = "sidebar",
  onNavigate,
}: {
  item: NavItem;
  /** Desktop (lg+) rail-collapsed state. Ignored when variant="full". */
  collapsed?: boolean;
  /**
   * "rail": responsive — icon-only + tooltip below lg (tablet rail) and when
   * `collapsed`, icon+label at lg otherwise. Used in the persistent Sidebar.
   * "full": always icon+label, no tooltip. Used in overlays (tablet drawer,
   * mobile more-sheet) that aren't width-constrained.
   */
  variant?: "rail" | "full";
  layoutScope?: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  const reduceMotion = useReducedMotion();
  const full = variant === "full";
  const { unreadCount } = useShell();

  // The nav-config badge is an illustrative default; the one real, live count
  // in the shell (the notification bell's unread count) overrides it here so
  // the sidebar never shows a stale/fabricated number for that item.
  const badgeValue = item.key === "notifications" ? (unreadCount > 0 ? unreadCount : undefined) : item.badge;

  // Vertical "journey" guide (item 7): a near-invisible line + node inside each
  // row's own left padding gutter, off by default and only shown where there's
  // room for the icon+label layout (never in icon-only rail/collapsed mode).
  const guideVisible = full ? "block" : collapsed ? "hidden" : "hidden lg:block";

  const link = (
    <MotionLink
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      whileHover={reduceMotion ? undefined : { x: 2 }}
      whileTap={reduceMotion ? undefined : { scale: 0.98 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className={`group relative flex min-h-11 items-center gap-sm overflow-hidden rounded-md text-sm outline-none focus-visible:ring-2 focus-visible:ring-sidebar-accent/70 ${
        full ? "px-md" : `justify-center px-0 ${collapsed ? "" : "lg:min-h-10 lg:justify-start lg:px-md"}`
      }`}
    >
      <span aria-hidden className={`pointer-events-none absolute z-10 inset-y-0 left-[5px] w-px ${guideVisible} ${active ? "bg-sidebar-accent/30" : "bg-sidebar-border-muted"}`} />
      <span
        aria-hidden
        className={`pointer-events-none absolute z-10 left-[3.5px] top-1/2 size-1 -translate-y-1/2 rounded-full ${guideVisible} ${
          active ? "bg-sidebar-accent shadow-[0_0_4px_var(--sidebar-active-glow)]" : "bg-sidebar-text-faint/50"
        }`}
      />

      {active && (
        <motion.span
          layoutId={`nav-active-capsule-${layoutScope}`}
          transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40, mass: 0.6 }}
          className="absolute inset-y-0.5 inset-x-0 rounded-md border border-sidebar-active-border bg-sidebar-active-bg shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
        >
          <span className="absolute inset-y-1.5 left-0 w-[2.5px] rounded-full bg-sidebar-accent shadow-[0_0_5px_var(--sidebar-active-glow)]" />
          <span className="absolute inset-0 rounded-md bg-[radial-gradient(circle_at_12%_50%,var(--sidebar-active-glow),transparent_70%)] opacity-30" />
        </motion.span>
      )}

      <span
        className={`relative z-10 shrink-0 transition-transform duration-150 motion-reduce:transition-none group-hover:-translate-y-px ${
          active ? "text-sidebar-accent" : "text-sidebar-text-muted group-hover:text-sidebar-accent"
        }`}
      >
        <Icon className="size-[18px]" aria-hidden="true" />
      </span>

      <span
        className={`relative z-10 truncate ${full ? "" : collapsed ? "hidden" : "hidden lg:inline"} ${
          active ? "font-semibold text-sidebar-active-text" : "font-medium text-sidebar-text-muted group-hover:text-sidebar-text"
        }`}
      >
        {item.label}
      </span>

      {badgeValue ? (
        full ? (
          <span className="relative z-10 ml-auto flex h-[22px] min-w-[22px] items-center justify-center rounded-full border border-sidebar-active-border bg-sidebar-active-bg px-1.5 text-[10px] font-semibold text-sidebar-text shadow-[0_0_6px_-1px_var(--sidebar-active-glow)]">
            {badgeValue}
          </span>
        ) : (
          <>
            <span
              className={`relative z-10 ml-auto ${
                collapsed ? "hidden" : "hidden lg:flex"
              } h-[22px] min-w-[22px] items-center justify-center rounded-full border border-sidebar-active-border bg-sidebar-active-bg px-1.5 text-[10px] font-semibold text-sidebar-text shadow-[0_0_6px_-1px_var(--sidebar-active-glow)]`}
            >
              {badgeValue}
            </span>
            <span
              className={`absolute right-1.5 top-1.5 z-10 size-1.5 rounded-full bg-sidebar-accent shadow-[0_0_4px_var(--sidebar-active-glow)] ${collapsed ? "" : "lg:hidden"}`}
            />
          </>
        )
      ) : null}
    </MotionLink>
  );

  if (full) return link;

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" className={collapsed ? "" : "lg:hidden"}>
        {item.label}
      </TooltipContent>
    </Tooltip>
  );
}
