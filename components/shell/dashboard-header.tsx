"use client"

import { Bell, ChevronDown, MessageSquare, Plus } from "lucide-react"

import { currentSchool } from "@/lib/dashboard-data"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarBadge } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { GlobalCommandSearch } from "@/components/shell/global-command-search"
import { principal } from "@/lib/dashboard-data"

export function DashboardHeader({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <header className="hidden flex-col gap-5 pt-8 lg:flex">
      <div className="flex items-center justify-between gap-6">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 text-sm font-medium text-foreground shadow-control transition-colors hover:border-ring/40">
              Session {currentSchool.academicSession}
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>2026–27 (current)</DropdownMenuItem>
              <DropdownMenuItem>2025–26</DropdownMenuItem>
              <DropdownMenuItem>2024–25</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button size="icon" variant="outline" className="rounded-full" aria-label="Messages">
            <MessageSquare />
          </Button>

          <Button size="icon" variant="outline" className="relative rounded-full" aria-label="Notifications, 4 unread">
            <Bell />
            <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-destructive" aria-hidden="true" />
          </Button>

          <Button className="rounded-full">
            <Plus />
            Quick create
          </Button>

          <Avatar className="ml-1 ring-2 ring-background">
            <AvatarFallback className="bg-gradient-to-br from-accent-violet to-accent-cyan text-primary-foreground">
              {principal.initials}
            </AvatarFallback>
            <AvatarBadge className="bg-success" />
          </Avatar>
        </div>
      </div>

      <GlobalCommandSearch />
    </header>
  )
}
