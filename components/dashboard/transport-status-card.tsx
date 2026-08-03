"use client"

import { Bus, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { transportStatus } from "@/lib/dashboard-data"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const statusColor: Record<string, string> = {
  "on-time": "bg-success",
  delayed: "bg-warning",
  arriving: "bg-accent-cyan",
}

export function TransportStatusCard() {
  return (
    <Card className="h-full gap-4">
      <CardHeader className="px-5">
        <CardTitle className="text-base">Transport Status</CardTitle>
        <CardDescription>{transportStatus.activeBuses} buses on active routes</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 px-5">
        <div className="grid grid-cols-3 gap-2.5">
          <div className="rounded-2xl bg-secondary px-2.5 py-2 text-center">
            <p className="text-lg font-semibold tabular-nums text-foreground">{transportStatus.activeBuses}</p>
            <p className="text-[10px] text-muted-foreground">Active</p>
          </div>
          <div className="rounded-2xl bg-secondary px-2.5 py-2 text-center">
            <p className="text-lg font-semibold tabular-nums text-warning">{transportStatus.delayed}</p>
            <p className="text-[10px] text-muted-foreground">Delayed</p>
          </div>
          <div className="rounded-2xl bg-secondary px-2.5 py-2 text-center">
            <p className="text-lg font-semibold tabular-nums text-accent-cyan">{transportStatus.arrivingSoon}</p>
            <p className="text-[10px] text-muted-foreground">Arriving</p>
          </div>
        </div>

        <div
          className="relative h-28 overflow-hidden rounded-2xl bg-secondary"
          role="img"
          aria-label={`Route map with ${transportStatus.activeBuses} buses: ${transportStatus.delayed} delayed, ${transportStatus.arrivingSoon} arriving soon`}
        >
          <svg className="absolute inset-0 size-full" aria-hidden="true">
            <path
              d="M 10 80 Q 100 20 200 60 T 380 40"
              fill="none"
              stroke="var(--border)"
              strokeWidth="2"
              strokeDasharray="4 5"
            />
          </svg>
          {transportStatus.routes.map((route) => (
            <Tooltip key={route.id}>
              <TooltipTrigger
                render={
                  <span
                    className={cn(
                      "absolute flex size-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-background shadow-control",
                      statusColor[route.status]
                    )}
                    style={{ left: `${route.x}%`, top: `${route.y}%` }}
                  />
                }
              >
                <Bus className="size-3" />
              </TooltipTrigger>
              <TooltipContent>
                {route.route} — {route.status.replace("-", " ")}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </CardContent>

      <CardFooter className="border-t-0 bg-transparent px-5">
        <Button variant="ghost" className="ml-auto gap-1 text-sm">
          View transport
          <ChevronRight className="size-3.5" />
        </Button>
      </CardFooter>
    </Card>
  )
}
