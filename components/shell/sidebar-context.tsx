"use client"

import * as React from "react"

interface SidebarState {
  collapsed: boolean
  toggle: () => void
}

const SidebarContext = React.createContext<SidebarState | null>(null)

export function SidebarStateProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = React.useState(false)

  const value = React.useMemo<SidebarState>(
    () => ({
      collapsed,
      toggle: () => setCollapsed((prev) => !prev),
    }),
    [collapsed]
  )

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
}

export function useSidebarState() {
  const ctx = React.useContext(SidebarContext)
  if (!ctx) {
    throw new Error("useSidebarState must be used within SidebarStateProvider")
  }
  return ctx
}
