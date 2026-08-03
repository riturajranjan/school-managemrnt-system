"use client"

import { ArrowUpRight, ChevronRight } from "lucide-react"
import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts"

import { academicHealth } from "@/lib/dashboard-data"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export function AcademicHealthCard() {
  const trendData = academicHealth.trend.map((value, index) => ({ index, value }))

  return (
    <Card className="relative h-full gap-4">
      <CardHeader className="px-5">
        <CardTitle className="text-base">Academic Health</CardTitle>
        <CardDescription>Composite score across all classes</CardDescription>
        <Badge variant="secondary" className="absolute top-4 right-5 gap-1 text-success">
          <ArrowUpRight className="size-3" />+{academicHealth.weeklyChange} this week
        </Badge>
      </CardHeader>

      <CardContent className="px-5">
        <div className="grid grid-cols-1 items-center gap-5 sm:grid-cols-[auto_1fr]">
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-semibold tabular-nums text-foreground">
              {academicHealth.overallScore}
            </span>
            <span className="text-sm text-muted-foreground">/100</span>
          </div>

          <div className="h-14 w-full" role="img" aria-label={`Academic health trend rising to ${academicHealth.overallScore} over the last 6 weeks`}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                <YAxis hide domain={["dataMin - 4", "dataMax + 4"]} />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="var(--chart-1)"
                  strokeWidth={2.5}
                  dot={false}
                  animationDuration={1000}
                  animationEasing="ease-out"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <div className="rounded-2xl bg-secondary px-3 py-2.5">
            <p className="text-[11px] text-muted-foreground">Strongest subject</p>
            <p className="text-sm font-medium text-success">{academicHealth.strongestSubject}</p>
          </div>
          <div className="rounded-2xl bg-secondary px-3 py-2.5">
            <p className="text-[11px] text-muted-foreground">Needs attention</p>
            <p className="text-sm font-medium text-warning">{academicHealth.weakestSubject}</p>
          </div>
          <div className="rounded-2xl bg-secondary px-3 py-2.5">
            <p className="text-[11px] text-muted-foreground">Students flagged</p>
            <p className="text-sm font-medium text-foreground">{academicHealth.studentsNeedingAttention} students</p>
          </div>
        </div>
      </CardContent>

      <CardFooter className="border-t-0 bg-transparent px-5">
        <Button variant="ghost" className="ml-auto gap-1 text-sm">
          View academics
          <ChevronRight className="size-3.5" />
        </Button>
      </CardFooter>
    </Card>
  )
}
