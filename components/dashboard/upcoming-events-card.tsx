"use client"

import { CalendarDays, ChevronRight, FlaskConical, PartyPopper, Users2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { upcomingEvents, type EventCategory } from "@/lib/dashboard-data"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

const categoryMeta: Record<EventCategory, { icon: typeof CalendarDays; label: string; tone: string }> = {
  meeting: { icon: Users2, label: "Meeting", tone: "bg-accent-cyan/15 text-accent-cyan" },
  exhibition: { icon: FlaskConical, label: "Exhibition", tone: "bg-accent-violet/15 text-accent-violet" },
  exam: { icon: CalendarDays, label: "Examination", tone: "bg-warning/15 text-warning" },
  holiday: { icon: PartyPopper, label: "Holiday", tone: "bg-success/15 text-success" },
}

export function UpcomingEventsCard() {
  return (
    <Card className="h-full gap-4">
      <CardHeader className="px-5">
        <CardTitle className="text-base">Upcoming Events</CardTitle>
        <CardDescription>Next four weeks</CardDescription>
      </CardHeader>

      <CardContent className="px-5">
        <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {upcomingEvents.map((event) => {
            const meta = categoryMeta[event.category]
            return (
              <li
                key={event.id}
                className="flex items-center gap-3 rounded-2xl bg-secondary px-3.5 py-3"
              >
                <div className="flex flex-col items-center justify-center rounded-xl bg-card px-2.5 py-1.5 text-center shadow-control">
                  <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                    {event.day}
                  </span>
                  <span className="text-sm font-semibold text-foreground">{event.date.split(" ")[1]}</span>
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="truncate text-sm font-medium text-foreground">{event.title}</p>
                  <span
                    className={cn(
                      "inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                      meta.tone
                    )}
                  >
                    <meta.icon className="size-2.5" />
                    {meta.label}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      </CardContent>

      <CardFooter className="border-t-0 bg-transparent px-5">
        <Button variant="ghost" className="ml-auto gap-1 text-sm">
          Full calendar
          <ChevronRight className="size-3.5" />
        </Button>
      </CardFooter>
    </Card>
  )
}
