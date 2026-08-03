"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"

import { cn } from "@/lib/utils"

export function ThemeToggle({
  collapsed = false,
  className,
}: {
  collapsed?: boolean
  className?: string
}) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => setMounted(true), [])

  const isDark = mounted && resolvedTheme === "dark"

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      aria-pressed={isDark}
      className={cn(
        "group relative inline-flex h-9 shrink-0 items-center gap-2 overflow-hidden rounded-full border border-sidebar-border bg-sidebar-accent/40 px-1 text-xs font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        collapsed ? "w-9 justify-center" : "w-full justify-start",
        className
      )}
    >
      <span
        className={cn(
          "relative flex size-7 shrink-0 items-center justify-center rounded-full bg-background text-foreground shadow-control transition-transform duration-300",
          !collapsed && isDark && "translate-x-[calc(100%-0.5rem)]"
        )}
      >
        <Sun className="absolute size-3.5 scale-100 opacity-100 transition-all duration-300 dark:scale-0 dark:opacity-0" />
        <Moon className="absolute size-3.5 scale-0 opacity-0 transition-all duration-300 dark:scale-100 dark:opacity-100" />
      </span>
      {!collapsed && (
        <span className="truncate pr-2 text-muted-foreground">
          {mounted ? (isDark ? "Dark theme" : "Light theme") : "Theme"}
        </span>
      )}
    </button>
  )
}
