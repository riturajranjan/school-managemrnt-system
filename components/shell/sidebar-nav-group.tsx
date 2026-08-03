"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion } from "framer-motion"

import { cn } from "@/lib/utils"
import type { NavGroup } from "@/lib/dashboard-data"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"

export function SidebarNavGroup({
  group,
  collapsed = false,
}: {
  group: NavGroup
  collapsed?: boolean
}) {
  const pathname = usePathname()

  return (
    <div role="group" aria-label={group.label} className="flex flex-col gap-0.5 px-3">
      {!collapsed && (
        <p className="px-2.5 pt-3 pb-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground/80 uppercase">
          {group.label}
        </p>
      )}
      {collapsed && <div className="pt-3" aria-hidden="true" />}
      <ul className="flex flex-col gap-0.5">
        {group.items.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon

          const link = (
            <Link
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "group relative flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium text-sidebar-foreground/75 outline-none transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
                isActive && "text-sidebar-accent-foreground",
                collapsed && "justify-center px-0"
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="sidebar-active-indicator"
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                  className="absolute inset-0 rounded-xl bg-sidebar-accent shadow-control"
                />
              )}
              {isActive && (
                <motion.span
                  layoutId="sidebar-active-bar"
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                  className="absolute left-0 top-1/2 h-4.5 w-[3px] -translate-y-1/2 rounded-full bg-primary"
                />
              )}
              <Icon
                className={cn(
                  "relative z-10 size-[18px] shrink-0",
                  isActive ? "text-primary" : "text-sidebar-foreground/60 group-hover:text-sidebar-foreground"
                )}
              />
              {!collapsed && (
                <span className="relative z-10 truncate">{item.label}</span>
              )}
              {!collapsed && item.badge && (
                <Badge variant="secondary" className="relative z-10 ml-auto h-4.5 px-1.5 text-[10px]">
                  {item.badge}
                </Badge>
              )}
            </Link>
          )

          if (!collapsed) {
            return <li key={item.href}>{link}</li>
          }

          return (
            <li key={item.href}>
              <Tooltip>
                <TooltipTrigger render={link} />
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
