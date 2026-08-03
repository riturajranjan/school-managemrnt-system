import { DashboardHeader } from "@/components/shell/dashboard-header"
import { DashboardHero } from "@/components/dashboard/dashboard-hero"
import { BentoGrid, BentoItem } from "@/components/dashboard/bento-grid"
import { AttendancePulseCard } from "@/components/dashboard/attendance-pulse-card"
import { AIMorningBriefCard } from "@/components/dashboard/ai-morning-brief-card"
import { CampusActivityCard } from "@/components/dashboard/campus-activity-card"
import { FeeCollectionCard } from "@/components/dashboard/fee-collection-card"
import { AcademicHealthCard } from "@/components/dashboard/academic-health-card"
import { TodayTimetableCard } from "@/components/dashboard/today-timetable-card"
import { TransportStatusCard } from "@/components/dashboard/transport-status-card"
import { UpcomingEventsCard } from "@/components/dashboard/upcoming-events-card"
import { QuickActionsCard } from "@/components/dashboard/quick-actions-card"

export default function CommandCenterPage() {
  return (
    <div className="flex flex-col gap-6 pb-6">
      <DashboardHeader
        title="Command Center"
        description="Here is what is happening across your campus today."
      />

      <div className="flex flex-col gap-1 pt-5 lg:hidden">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Command Center</h1>
        <p className="text-sm text-muted-foreground">
          Here is what is happening across your campus today.
        </p>
      </div>

      <DashboardHero />

      <BentoGrid>
        <BentoItem className="md:col-span-2 xl:col-span-2 xl:row-span-2">
          <AttendancePulseCard />
        </BentoItem>
        <BentoItem className="md:col-span-2 xl:col-span-2">
          <AIMorningBriefCard />
        </BentoItem>
        <BentoItem className="xl:row-span-2">
          <CampusActivityCard />
        </BentoItem>
        <BentoItem>
          <FeeCollectionCard />
        </BentoItem>
        <BentoItem className="md:col-span-2 xl:col-span-2">
          <AcademicHealthCard />
        </BentoItem>
        <BentoItem>
          <TodayTimetableCard />
        </BentoItem>
        <BentoItem>
          <TransportStatusCard />
        </BentoItem>
        <BentoItem className="md:col-span-2">
          <UpcomingEventsCard />
        </BentoItem>
        <BentoItem className="md:col-span-2">
          <QuickActionsCard />
        </BentoItem>
      </BentoGrid>
    </div>
  )
}
