"use client"

import { Bell } from "lucide-react"

import { EduNexaMark } from "@/components/shell/edunexa-mark"
import { GlobalCommandSearch } from "@/components/shell/global-command-search"
import { Button } from "@/components/ui/button"

export function MobileHeader() {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border/70 bg-background/85 px-4 py-3 backdrop-blur-lg lg:hidden">
      <div className="flex items-center gap-2">
        <EduNexaMark />
        <span className="text-[15px] font-semibold tracking-tight">EduNexa</span>
      </div>
      <div className="flex items-center gap-2">
        <GlobalCommandSearch compact />
        <Button size="icon" variant="outline" className="relative size-10 rounded-full" aria-label="Notifications, 4 unread">
          <Bell />
          <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-destructive" aria-hidden="true" />
        </Button>
      </div>
    </header>
  )
}
