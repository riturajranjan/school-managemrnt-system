import { ActionInboxWidget } from "./widgets/action-inbox";
import { AiMorningBriefWidget } from "./widgets/ai-morning-brief";
import { AttendanceWidget } from "./widgets/attendance";
import { CampusOverview3DWidget } from "./widgets/campus-overview-3d";
import { ExceptionFeedWidget } from "./widgets/exception-feed";
import { FeeCollectionWidget } from "./widgets/fee-collection";
import { QuickActionsWidget } from "./widgets/quick-actions";
import { SchoolPulseWidget } from "./widgets/school-pulse";
import { StaffAvailabilityWidget } from "./widgets/staff-availability";
import { TodaysTimetableWidget } from "./widgets/todays-timetable";
import { TransportStatusWidget } from "./widgets/transport-status";
import { UpcomingEventsWidget } from "./widgets/upcoming-events";

// Desktop reads top-to-bottom in 4 rows (see class comments below); tablet
// reuses that same priority order in a 2-column flow; mobile has its own
// explicit order (Quick Actions inserted, Staff/Transport dropped, 3D summary
// pushed to the end) via the unprefixed `order-*` on each item.
export function DashboardGrid() {
  return (
    <div className="grid grid-cols-1 gap-sm sm:gap-md md:grid-cols-2 lg:grid-cols-12">
      {/* Row 1 — AI Morning Brief, School Pulse */}
      <div className="order-1 md:order-1 lg:col-span-7">
        <AiMorningBriefWidget />
      </div>
      <div className="order-2 md:order-2 lg:col-span-5">
        <SchoolPulseWidget />
      </div>

      {/* Mobile only, position 3 */}
      <div className="order-3 md:hidden">
        <QuickActionsWidget />
      </div>

      {/* Row 2 — 3D Campus Overview, Action Inbox */}
      <div className="order-10 md:order-3 md:col-span-2 lg:col-span-8">
        <CampusOverview3DWidget />
      </div>
      <div className="order-6 md:order-4 md:col-span-2 lg:col-span-4">
        <ActionInboxWidget />
      </div>

      {/* Row 3 — Attendance, Fee Collection, Staff Availability, Transport Status.
          Stays 2-across through lg (1024px doesn't have room for 4 columns of
          this widget's content) and only goes 4-across at xl. */}
      <div className="order-4 md:order-5 lg:col-span-6 xl:col-span-3">
        <AttendanceWidget />
      </div>
      <div className="order-5 md:order-6 lg:col-span-6 xl:col-span-3">
        <FeeCollectionWidget />
      </div>
      <div className="hidden md:order-7 md:block lg:col-span-6 xl:col-span-3">
        <StaffAvailabilityWidget />
      </div>
      <div className="hidden md:order-8 md:block lg:col-span-6 xl:col-span-3">
        <TransportStatusWidget />
      </div>

      {/* Row 4 — Exception Feed, Today's Timetable, Upcoming Events */}
      <div className="order-7 md:order-9 lg:col-span-4">
        <ExceptionFeedWidget />
      </div>
      <div className="order-8 md:order-10 lg:col-span-4">
        <TodaysTimetableWidget />
      </div>
      <div className="order-9 md:order-11 lg:col-span-4">
        <UpcomingEventsWidget />
      </div>
    </div>
  );
}
