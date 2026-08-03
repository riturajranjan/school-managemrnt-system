"use client"

import { ChevronRight, TrendingUp } from "lucide-react"
import { Bar, BarChart, ResponsiveContainer } from "recharts"

import { feeCollection } from "@/lib/dashboard-data"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"

export function FeeCollectionCard() {
  const trendData = feeCollection.monthlyTrend.map((value, index) => ({ index, value }))

  return (
    <Card className="h-full gap-4">
      <CardHeader className="px-5">
        <CardTitle className="text-base">Fee Collection</CardTitle>
        <CardDescription>This month, all classes</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 px-5">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold tabular-nums text-foreground">
            ₹{feeCollection.collectedLakh}L
          </span>
          <span className="text-xs text-muted-foreground">collected of target</span>
        </div>

        <Progress value={feeCollection.monthlyTargetPercent} aria-label="Monthly collection target progress">
          <div className="flex w-full items-center justify-between text-xs">
            <span className="font-medium text-foreground">{feeCollection.monthlyTargetPercent}% of monthly target</span>
            <span className="text-muted-foreground">₹{feeCollection.pendingLakh}L pending</span>
          </div>
        </Progress>

        <div className="flex items-center justify-between rounded-2xl bg-secondary px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <TrendingUp className="size-3.5 text-success" />
            Forecasted this month
          </div>
          <span className="text-sm font-semibold tabular-nums text-foreground">₹{feeCollection.forecastLakh}L</span>
        </div>

        <div className="h-10 w-full" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trendData} barGap={3} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <Bar dataKey="value" fill="var(--primary)" radius={[3, 3, 0, 0]} animationDuration={800} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <span className="sr-only">6-month collection trend rising from ₹{feeCollection.monthlyTrend[0]}L to ₹{feeCollection.collectedLakh}L</span>
      </CardContent>

      <CardFooter className="border-t-0 bg-transparent px-5">
        <Button variant="ghost" className="ml-auto gap-1 text-sm">
          View finance
          <ChevronRight className="size-3.5" />
        </Button>
      </CardFooter>
    </Card>
  )
}
