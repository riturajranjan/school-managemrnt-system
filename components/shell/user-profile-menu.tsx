"use client"

import { MoreHorizontal, User, LogOut, Settings } from "lucide-react"

import { cn } from "@/lib/utils"
import { principal } from "@/lib/dashboard-data"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function UserProfileMenu({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "group flex w-full items-center gap-2.5 rounded-2xl border border-transparent px-2 py-2 text-left transition-colors hover:border-sidebar-border hover:bg-sidebar-accent/60 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          collapsed && "justify-center px-0"
        )}
        aria-label="Open profile menu"
      >
        <Avatar className="shrink-0 ring-2 ring-background">
          <AvatarFallback className="bg-gradient-to-br from-accent-violet to-accent-cyan text-primary-foreground">
            {principal.initials}
          </AvatarFallback>
        </Avatar>
        {!collapsed && (
          <>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium text-sidebar-foreground">
                {principal.name}
              </span>
              <span className="truncate text-xs text-muted-foreground">{principal.role}</span>
            </span>
            <MoreHorizontal className="size-4 shrink-0 text-muted-foreground" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-56">
        <DropdownMenuItem>
          <User className="size-3.5" />
          View profile
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Settings className="size-3.5" />
          Account settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive">
          <LogOut className="size-3.5" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
