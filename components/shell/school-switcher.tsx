"use client"

import { ChevronsUpDown, Check, Plus } from "lucide-react"

import { cn } from "@/lib/utils"
import { currentSchool } from "@/lib/dashboard-data"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function SchoolSwitcher({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "group flex w-full items-center gap-2.5 rounded-2xl border border-transparent px-2 py-2 text-left transition-colors hover:border-sidebar-border hover:bg-sidebar-accent/60 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          collapsed && "justify-center px-0"
        )}
        aria-label={`Switch school, current school ${currentSchool.name}`}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent-violet text-xs font-semibold text-primary-foreground shadow-control">
          {currentSchool.crestInitials}
        </span>
        {!collapsed && (
          <>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium text-sidebar-foreground">
                {currentSchool.name}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                Session {currentSchool.academicSession}
              </span>
            </span>
            <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground transition-transform group-aria-expanded:rotate-180" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Your schools</DropdownMenuLabel>
        <DropdownMenuItem className="justify-between">
          <span className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-md bg-gradient-to-br from-primary to-accent-violet text-[10px] font-semibold text-primary-foreground">
              {currentSchool.crestInitials}
            </span>
            {currentSchool.name}
          </span>
          <Check className="size-3.5 text-primary" />
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <Plus className="size-3.5" />
          Add another school
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
