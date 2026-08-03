"use client"

import { ChevronRight, Clock, MapPin, Repeat, User } from "lucide-react"

import { cn } from "@/lib/utils"
import { todayTimetable } from "@/lib/dashboard-data"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export function TodayTimetableCard() {
  return (
    <Card className="h-full gap-4">
      <CardHeader className="px-5">
        <CardTitle className="text-base">Today&apos;s Timetable</CardTitle>
        <CardDescription>Live period tracking</CardDescription>
      </CardHeader>

      <CardContent className="px-5">
        <ul className="flex flex-col gap-2.5">
          {todayTimetable.map((slot) => (
            <li
              key={slot.id}
              className={cn(
                "flex flex-col gap-1.5 rounded-2xl border px-3.5 py-3",
                slot.isCurrent
                  ? "border-primary/25 bg-primary/[0.06] shadow-control"
                  : "border-transparent bg-secondary"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                  <Clock className="size-3" />
                  {slot.time}
                </span>
                {slot.isCurrent && (
                  <Badge className="h-4.5 bg-primary px-1.5 text-[10px]">Now</Badge>
                )}
                {slot.isSubstitution && (
                  <Badge variant="secondary" className="h-4.5 gap-1 px-1.5 text-[10px] text-warning">
                    <Repeat className="size-2.5" />
                    Substitution
                  </Badge>
                )}
              </div>
              <p className="text-sm font-medium text-foreground">
                {slot.subject} · {slot.className}
              </p>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <User className="size-3" />
                  {slot.teacher}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="size-3" />
                  {slot.room}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>

      <CardFooter className="border-t-0 bg-transparent px-5">
        <Button variant="ghost" className="ml-auto gap-1 text-sm">
          Full timetable
          <ChevronRight className="size-3.5" />
        </Button>
      </CardFooter>
    </Card>
  )
}
