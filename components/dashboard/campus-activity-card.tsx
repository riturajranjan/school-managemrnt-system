"use client"

import { motion } from "framer-motion"

import { cn } from "@/lib/utils"
import { campusActivity, type ActivityStatus } from "@/lib/dashboard-data"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"

const statusDot: Record<ActivityStatus, string> = {
  success: "bg-success",
  info: "bg-accent-cyan",
  warning: "bg-warning",
}

export function CampusActivityCard() {
  return (
    <Card className="h-full gap-4">
      <CardHeader className="px-5">
        <CardTitle className="text-base">Campus Activity</CardTitle>
        <CardDescription>Live feed since the gates opened</CardDescription>
      </CardHeader>

      <CardContent className="px-5">
        <ol className="relative flex flex-col gap-5 pl-4">
          <div className="absolute top-1.5 bottom-1.5 left-[3px] w-px bg-border" aria-hidden="true" />
          {campusActivity.map((event, index) => (
            <motion.li
              key={event.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: index * 0.08, ease: "easeOut" }}
              className="relative flex flex-col gap-0.5"
            >
              <span
                className={cn(
                  "absolute top-1.5 -left-4 size-[7px] -translate-x-1/2 rounded-full ring-4 ring-card",
                  statusDot[event.status]
                )}
                aria-hidden="true"
              />
              <span className="text-[11px] font-medium tabular-nums text-muted-foreground">{event.time}</span>
              <span className="text-sm text-foreground">{event.label}</span>
            </motion.li>
          ))}
        </ol>
      </CardContent>
    </Card>
  )
}
