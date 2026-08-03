"use client"

import { quickActions } from "@/lib/dashboard-data"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Kbd } from "@/components/ui/kbd"

export function QuickActionsCard() {
  return (
    <Card className="h-full gap-4">
      <CardHeader className="px-5">
        <CardTitle className="text-base">Quick Actions</CardTitle>
        <CardDescription>Jump straight into common tasks</CardDescription>
      </CardHeader>

      <CardContent className="px-5">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {quickActions.map((action) => (
            <button
              key={action.id}
              type="button"
              className="group flex flex-col items-start gap-3 rounded-2xl border border-border bg-secondary/60 px-3.5 py-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-ring/30 hover:bg-secondary hover:shadow-control focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="flex size-9 items-center justify-center rounded-xl bg-card text-primary shadow-control transition-transform group-hover:scale-105">
                <action.icon className="size-4" />
              </span>
              <span className="flex w-full items-center justify-between gap-2">
                <span className="text-[13px] leading-tight font-medium text-foreground">{action.label}</span>
                {action.shortcut && <Kbd className="shrink-0">{action.shortcut}</Kbd>}
              </span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
