"use client"

import * as React from "react"

import { SidebarStateProvider, useSidebarState } from "@/components/shell/sidebar-context"
import { DesktopSidebar } from "@/components/shell/desktop-sidebar"
import { MobileHeader } from "@/components/shell/mobile-header"
import { MobileBottomNavigation } from "@/components/shell/mobile-bottom-navigation"
import { NexaAIButton } from "@/components/nexa/nexa-ai-button"
import { NexaAIPanel } from "@/components/nexa/nexa-ai-panel"
import { cn } from "@/lib/utils"

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarStateProvider>
      <AppShellLayout>{children}</AppShellLayout>
    </SidebarStateProvider>
  )
}

function AppShellLayout({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebarState()
  const [nexaOpen, setNexaOpen] = React.useState(false)

  return (
    <div className="relative min-h-screen bg-radial-fade">
      <DesktopSidebar />
      <MobileHeader />

      <div
        className={cn(
          "flex min-h-screen flex-col transition-[padding] duration-300 ease-out",
          collapsed ? "lg:pl-[112px]" : "lg:pl-[312px]"
        )}
      >
        <main className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-6 px-4 pb-28 sm:px-6 lg:px-8 lg:pb-10">
          {children}
        </main>
      </div>

      <MobileBottomNavigation />

      <NexaAIButton open={nexaOpen} onClick={() => setNexaOpen((prev) => !prev)} />
      <NexaAIPanel open={nexaOpen} onClose={() => setNexaOpen(false)} />
    </div>
  )
}
