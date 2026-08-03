"use client"

import { ChevronRight, Sparkles } from "lucide-react"

import { cn } from "@/lib/utils"
import { aiMorningInsights, type InsightPriority } from "@/lib/dashboard-data"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

const priorityStyles: Record<InsightPriority, { label: string; dot: string; text: string }> = {
  high: { label: "High priority", dot: "bg-destructive", text: "text-destructive" },
  medium: { label: "Medium priority", dot: "bg-warning", text: "text-warning" },
  low: { label: "Low priority", dot: "bg-muted-foreground", text: "text-muted-foreground" },
}

export function AIMorningBriefCard() {
  return (
    <Card className="h-full gap-4">
      <CardHeader className="px-5">
        <div className="flex items-center gap-2.5">
          <span className="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary via-accent-violet to-accent-cyan text-primary-foreground">
            <span className="absolute inset-0 animate-pulse rounded-full bg-white/15" aria-hidden="true" />
            <Sparkles className="size-4" />
          </span>
          <div>
            <CardTitle className="text-base">Nexa AI Morning Brief</CardTitle>
            <CardDescription>Generated 7:45 AM from live campus data</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-5">
        <ul className="flex flex-col divide-y divide-border">
          {aiMorningInsights.map((insight) => {
            const style = priorityStyles[insight.priority]
            return (
              <li key={insight.id}>
                <details className="group/insight py-2.5 first:pt-0 last:pb-0">
                  <summary className="flex cursor-pointer list-none items-center gap-2.5 rounded-lg py-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                    <span className={cn("size-1.5 shrink-0 rounded-full", style.dot)} aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                      {insight.label}
                    </span>
                    <span className={cn("hidden text-[11px] font-medium sm:inline", style.text)}>
                      {style.label}
                    </span>
                    <ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open/insight:rotate-90" />
                  </summary>
                  <p className="pt-1.5 pl-4 text-xs leading-relaxed text-muted-foreground">{insight.detail}</p>
                </details>
              </li>
            )
          })}
        </ul>
      </CardContent>

      <CardFooter className="border-t-0 bg-transparent px-5">
        <Button variant="secondary" className="ml-auto gap-1 rounded-full text-sm">
          Review all insights
          <ChevronRight className="size-3.5" />
        </Button>
      </CardFooter>
    </Card>
  )
}
