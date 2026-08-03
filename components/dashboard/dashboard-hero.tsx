"use client"

import { motion } from "framer-motion"

import { heroQuickActions, heroSummary } from "@/lib/dashboard-data"
import { Button } from "@/components/ui/button"
import { IsometricCampus } from "@/components/dashboard/isometric-campus"

export function DashboardHero() {
  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="relative grid gap-8 overflow-hidden rounded-[28px] border border-border bg-card p-6 shadow-elevated sm:p-8 lg:grid-cols-[1.05fr_0.95fr] lg:p-10"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/[0.06] via-transparent to-accent-violet/[0.08]"
        aria-hidden="true"
      />

      <div className="relative flex flex-col justify-center gap-5">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-[2rem]">
            Good morning, Principal
          </h2>
          <p suppressHydrationWarning className="text-sm text-muted-foreground">
            {dateLabel}
          </p>
        </div>

        <p className="max-w-xl text-[15px] leading-relaxed text-foreground/80">{heroSummary}</p>

        <div className="flex flex-wrap gap-2.5 pt-1">
          {heroQuickActions.map((action, index) => (
            <Button
              key={action.label}
              variant={index === 0 ? "default" : "outline"}
              className="rounded-full"
            >
              <action.icon />
              {action.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="relative flex items-center justify-center">
        <IsometricCampus />
      </div>
    </motion.section>
  )
}
