"use client"

import { ChevronLeft } from "lucide-react"
import { motion } from "framer-motion"

import { cn } from "@/lib/utils"
import { navGroups, currentSchool } from "@/lib/dashboard-data"
import { useSidebarState } from "@/components/shell/sidebar-context"
import { SidebarHeader } from "@/components/shell/sidebar-header"
import { SidebarNavGroup } from "@/components/shell/sidebar-nav-group"
import { UserProfileMenu } from "@/components/shell/user-profile-menu"
import { ThemeToggle } from "@/components/shell/theme-toggle"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"

export function DesktopSidebar() {
  const { collapsed, toggle } = useSidebarState()

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 88 : 288 }}
      transition={{ type: "spring", stiffness: 360, damping: 38 }}
      className="fixed top-6 bottom-6 left-6 z-40 hidden shrink-0 lg:block"
      aria-label="Primary"
    >
      <nav className="flex h-full flex-col rounded-[28px] border border-sidebar-border bg-sidebar shadow-float backdrop-blur-2xl">
        <SidebarHeader collapsed={collapsed} />

        <Separator className="mx-3 mt-4 bg-sidebar-border" />

        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-1 pb-3">
            {navGroups.map((group) => (
              <SidebarNavGroup key={group.label} group={group} collapsed={collapsed} />
            ))}
          </div>
        </ScrollArea>

        <Separator className="mx-3 bg-sidebar-border" />

        <div className={cn("flex flex-col gap-2 p-3", collapsed && "items-center")}>
          {!collapsed && (
            <p className="px-2 text-[11px] font-medium text-muted-foreground">
              Academic session {currentSchool.academicSession}
            </p>
          )}
          <ThemeToggle collapsed={collapsed} />
          <UserProfileMenu collapsed={collapsed} />
        </div>

        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          className="absolute top-9 -right-3 flex size-6 items-center justify-center rounded-full border border-sidebar-border bg-card text-muted-foreground shadow-control transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ChevronLeft className={cn("size-3.5 transition-transform duration-300", collapsed && "rotate-180")} />
        </button>
      </nav>
    </motion.aside>
  )
}
