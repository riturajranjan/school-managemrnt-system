"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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

  const link = (
    <MotionLink
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      whileHover={reduceMotion ? undefined : { rotate: 1.2, x: 2 }}
      whileTap={reduceMotion ? undefined : { scale: 0.98 }}
      transition={{ type: "spring", stiffness: 420, damping: 24, mass: 0.5 }}
      className={`group relative flex min-h-11 items-center gap-sm overflow-hidden rounded-lg text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-sidebar-foreground/60 ${
        full ? "px-md" : `justify-center px-0 ${collapsed ? "" : "lg:min-h-9 lg:justify-start lg:px-md"}`
      }`}
    >
      {active && (
        <motion.span
          layoutId={`nav-active-capsule-${layoutScope}`}
          transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40, mass: 0.6 }}
          className="absolute inset-0 rounded-lg border border-white/8 bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] backdrop-blur-sm"
        >
          <span className="absolute inset-y-1.5 left-0 w-[2.5px] rounded-full bg-accent shadow-[0_0_6px_rgba(24,176,200,0.7)]" />
          <span className="absolute inset-0 bg-gradient-to-br from-white/12 via-transparent to-transparent" />
        </motion.span>
      )}

      <span
        className={`relative z-10 shrink-0 transition-transform duration-150 motion-reduce:transition-none group-hover:-translate-y-px ${
          active ? "text-sidebar-foreground" : "text-sidebar-foreground/70 group-hover:text-sidebar-foreground"
        }`}
      >
        <Icon className="size-[18px]" aria-hidden="true" />
      </span>

      <span
        className={`relative z-10 truncate ${full ? "" : collapsed ? "hidden" : "hidden lg:inline"} ${
          active ? "text-sidebar-foreground" : "text-sidebar-foreground/75 group-hover:text-sidebar-foreground"
        }`}
      >
        {item.label}
      </span>

      {item.badge ? (
        full ? (
          <span className="relative z-10 ml-auto flex h-5 min-w-5 items-center justify-center rounded-pill bg-accent px-1.5 text-[10px] font-semibold text-accent-foreground">
            {item.badge}
          </span>
        ) : (
          <>
            <span
              className={`relative z-10 ml-auto ${
                collapsed ? "hidden" : "hidden lg:flex"
              } h-5 min-w-5 items-center justify-center rounded-pill bg-accent px-1.5 text-[10px] font-semibold text-accent-foreground`}
            >
              {item.badge}
            </span>
            <span
              className={`absolute right-1.5 top-1.5 z-10 size-1.5 rounded-full bg-accent ${collapsed ? "" : "lg:hidden"}`}
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
