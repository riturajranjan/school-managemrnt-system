"use client"

import { ArrowUpRight, ChevronRight } from "lucide-react"
import { RadialBar, RadialBarChart, PolarAngleAxis, ResponsiveContainer, AreaChart, Area } from "recharts"

import { attendancePulse } from "@/lib/dashboard-data"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export function AttendancePulseCard() {
  const radialData = [{ name: "attendance", value: attendancePulse.attendanceRate, fill: "var(--primary)" }]
  const trendData = attendancePulse.trend.map((value, index) => ({ index, value }))

  return (
    <Card className="relative h-full gap-5 p-1">
      <CardHeader className="px-5 pt-4">
        <CardTitle className="text-base">Live Attendance Pulse</CardTitle>
        <CardDescription>Real-time attendance across campus today</CardDescription>
        <Badge variant="secondary" className="absolute top-4 right-5 gap-1 text-success">
          <ArrowUpRight className="size-3" />+{attendancePulse.improvementFromYesterday}% vs yesterday
        </Badge>
      </CardHeader>

      <CardContent className="flex flex-col gap-5 px-5">
        <div className="grid grid-cols-1 items-center gap-5 sm:grid-cols-[minmax(0,160px)_1fr]">
          <div
            className="relative mx-auto size-40"
            role="img"
            aria-label={`${attendancePulse.attendanceRate}% attendance rate`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                innerRadius="72%"
                outerRadius="100%"
                barSize={12}
                data={radialData}
                startAngle={90}
                endAngle={-270}
              >
                <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                <RadialBar
                  background={{ fill: "var(--muted)" }}
                  dataKey="value"
                  cornerRadius={20}
                  animationDuration={900}
                  animationEasing="ease-out"
                />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-semibold tabular-nums text-foreground">
                {attendancePulse.attendanceRate}%
              </span>
              <span className="text-[11px] text-muted-foreground">present today</span>
            </div>
          </div>

          <dl className="grid grid-cols-3 gap-3 sm:grid-cols-1">
            <div className="flex items-center justify-between rounded-2xl bg-secondary px-3 py-2.5">
              <dt className="text-xs text-muted-foreground">Present</dt>
              <dd className="text-sm font-semibold tabular-nums text-foreground">
                {attendancePulse.present.toLocaleString("en-IN")}
              </dd>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-secondary px-3 py-2.5">
              <dt className="text-xs text-muted-foreground">Absent</dt>
              <dd className="text-sm font-semibold tabular-nums text-destructive">{attendancePulse.absent}</dd>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-secondary px-3 py-2.5">
              <dt className="text-xs text-muted-foreground">Late</dt>
              <dd className="text-sm font-semibold tabular-nums text-warning">{attendancePulse.late}</dd>
            </div>
          </dl>
        </div>

        <div className="h-16 w-full" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="attendance-trend-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke="var(--primary)"
                strokeWidth={2}
                fill="url(#attendance-trend-fill)"
                animationDuration={900}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <span className="sr-only">
          7-day attendance trend rising from {attendancePulse.trend[0]}% to {attendancePulse.attendanceRate}%
        </span>
      </CardContent>

      <CardFooter className="border-t-0 bg-transparent px-5 pb-4">
        <Button variant="ghost" className="ml-auto gap-1 text-sm">
          View attendance
          <ChevronRight className="size-3.5" />
        </Button>
      </CardFooter>
    </Card>
  )
}
