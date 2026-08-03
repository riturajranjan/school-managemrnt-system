"use client"

import { Sparkles } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const particles = [
  { top: "18%", left: "28%", delay: "0s" },
  { top: "62%", left: "20%", delay: "0.6s" },
  { top: "30%", left: "68%", delay: "1.1s" },
  { top: "70%", left: "64%", delay: "1.6s" },
]

export function NexaAIButton({
  open,
  onClick,
}: {
  open: boolean
  onClick: () => void
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={onClick}
            aria-label="Ask Nexa AI"
            aria-expanded={open}
            className={cn(
              "group fixed right-5 bottom-24 z-40 flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-primary via-accent-violet to-accent-cyan text-primary-foreground shadow-glow-primary transition-transform duration-300 hover:scale-105 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 lg:right-8 lg:bottom-8",
              open && "scale-95"
            )}
          />
        }
      >
        <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-accent-violet/40 [animation-duration:2.6s]" aria-hidden="true" />
        <span className="absolute inset-1.5 rounded-full bg-white/10 blur-[2px]" aria-hidden="true" />
        {particles.map((particle, index) => (
          <span
            key={index}
            className="absolute size-1 animate-pulse rounded-full bg-white/80"
            style={{ top: particle.top, left: particle.left, animationDelay: particle.delay, animationDuration: "2.2s" }}
            aria-hidden="true"
          />
        ))}
        <Sparkles className="relative z-10 size-6" />
      </TooltipTrigger>
      <TooltipContent side="left">Ask Nexa AI</TooltipContent>
    </Tooltip>
  )
}
