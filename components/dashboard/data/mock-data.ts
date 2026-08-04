import type {
  ActionInboxData,
  AiBriefData,
  AttendanceData,
  CampusOverviewData,
  ExceptionFeedData,
  FeeCollectionData,
  SchoolPulseData,
  StaffAvailabilityData,
  TodaysTimetableData,
  TransportStatusData,
  UpcomingEventsData,
} from "./types";

// Every fetcher below simulates a real network round trip (latency + the
// possibility of throwing) so widgets exercise genuine loading/error paths
// rather than reading a synchronous constant. Swap the body for a real
// endpoint later; the return type is the contract widgets already code against.
function delay<T>(value: T, ms: number): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export async function fetchAiBrief(): Promise<AiBriefData> {
  return delay(
    {
      generatedAt: "Today, 7:45 AM",
      insights: [
        {
          id: "i1",
          title: "3 teachers are absent",
          category: "staff",
          priority: "high",
          timeContext: "As of 8:00 AM",
          recommendedAction: "Arrange substitute coverage for Grade 6–9 classes before first period.",
          explanation:
            "3 of 86 staff have not checked in and have no approved leave on file — above the 2-teacher daily threshold that normally triggers a heads-up.",
        },
        {
          id: "i2",
          title: "Class 8B attendance is below 70%",
          category: "attendance",
          priority: "high",
          timeContext: "Homeroom, 9:15 AM",
          recommendedAction: "Contact the Class 8B homeroom teacher to confirm attendance was marked correctly.",
          explanation:
            "Class 8B attendance (68%) is more than 20 points below the school-wide average of 94%, which usually means either a marking error or a genuine absence spike worth checking.",
        },
        {
          id: "i3",
          title: "42 fee payments are overdue",
          category: "fees",
          priority: "medium",
          timeContext: "As of yesterday",
          recommendedAction: "Send a reminder batch to parents with dues more than 15 days late.",
          explanation:
            "42 invoices have crossed their due date by more than 15 days, accounting for ₹3.1L in outstanding fees this term.",
        },
        {
          id: "i4",
          title: "2 school buses are delayed",
          category: "transport",
          priority: "medium",
          timeContext: "Since 8:10 AM",
          recommendedAction: "Notify affected parents and monitor Route 2 and Route 4 live status.",
          explanation:
            "Routes 2 and 4 are both reporting ETAs more than 15 minutes past schedule, based on the last GPS check-in.",
        },
        {
          id: "i5",
          title: "5 admission applications require review",
          category: "admissions",
          priority: "low",
          timeContext: "Pending 3+ days",
          recommendedAction: "Assign an admissions officer to clear the review backlog this week.",
          explanation:
            "5 applications have sat in \"Documents submitted\" status for over 3 days without a reviewer assigned.",
        },
        {
          id: "i6",
          title: "Science exam results await approval",
          category: "academics",
          priority: "low",
          timeContext: "Submitted yesterday",
          recommendedAction: "Review and approve Grade 10 Science results before they publish to parents.",
          explanation:
            "Grade 10 Science exam results were submitted by the subject teacher and are awaiting your sign-off before publishing.",
        },
      ],
    },
    500,
  );
}

export async function fetchSchoolPulse(): Promise<SchoolPulseData> {
  return delay(
    {
      score: 75,
      status: "Good",
      weeklyChangePts: 4,
      positiveFactor: { label: "Attendance", detail: "94% today, 3 points above last week" },
      riskFactor: { label: "Pending Approvals", detail: "5 items awaiting sign-off, oldest is 4 days old" },
      recommendedAction: "Clear the approvals backlog today before it drags down next week's score.",
      factors: [
        { key: "attendance", label: "Attendance", score: 94, displayValue: "94%", tone: "success" },
        { key: "fees", label: "Fee Collection", score: 78, displayValue: "78%", tone: "warning" },
        { key: "academics", label: "Academic Performance", score: 88, displayValue: "88%", tone: "success" },
        { key: "staff", label: "Staff Availability", score: 91, displayValue: "91%", tone: "success" },
        { key: "parentEngagement", label: "Parent Engagement", score: 62, displayValue: "62%", tone: "warning" },
        { key: "transport", label: "Transport Status", score: 70, displayValue: "2 delayed", tone: "warning" },
        { key: "approvals", label: "Pending Approvals", score: 55, displayValue: "5 pending", tone: "warning" },
        { key: "issues", label: "Open Issues", score: 60, displayValue: "4 open", tone: "warning" },
      ],
    },
    450,
  );
}

export async function fetchCampusOverview(): Promise<CampusOverviewData> {
  return delay(
    {
      occupancyPercent: 82,
      activeZones: 5,
      totalZones: 6,
      zones: [
        { id: "academic", name: "Academic Block", occupancyPercent: 91, status: "busy", col: 0, row: 0, height: 64 },
        { id: "sports", name: "Sports Complex", occupancyPercent: 34, status: "normal", col: 1, row: 0, height: 36 },
        { id: "hostel", name: "Hostel Wing", occupancyPercent: 76, status: "normal", col: 0, row: 1, height: 52 },
        { id: "admin", name: "Admin Block", occupancyPercent: 58, status: "normal", col: 1, row: 1, height: 44 },
        { id: "library", name: "Library", occupancyPercent: 88, status: "busy", col: 2, row: 0, height: 40 },
        { id: "cafeteria", name: "Cafeteria", occupancyPercent: 12, status: "alert", col: 2, row: 1, height: 28 },
      ],
    },
    700,
  );
}

export async function fetchActionInbox(): Promise<ActionInboxData> {
  return delay(
    {
      items: [
        {
          id: "a1",
          title: "Approve leave — Rajesh Kumar",
          description: "Physics teacher requesting 2 days casual leave starting tomorrow.",
          category: "leave",
          priority: "high",
          dueLabel: "Due today",
          requestedBy: "Rajesh Kumar",
        },
        {
          id: "a2",
          title: "Approve leave — Meena Iyer",
          description: "Front office staff requesting half-day leave this afternoon.",
          category: "leave",
          priority: "medium",
          dueLabel: "Due today",
          requestedBy: "Meena Iyer",
        },
        {
          id: "a3",
          title: "Review admission — Kabir Singh",
          description: "Grade 3 admission application awaiting document verification.",
          category: "admission",
          priority: "medium",
          dueLabel: "Due tomorrow",
          requestedBy: "Admissions Office",
        },
        {
          id: "a4",
          title: "Fee concession — Ananya Verma",
          description: "Sibling discount request of 15% for Grade 5, pending finance sign-off.",
          category: "fee-concession",
          priority: "medium",
          dueLabel: "Due Friday",
          requestedBy: "Finance Desk",
        },
        {
          id: "a5",
          title: "Issue transfer certificate — Aarav Mehta",
          description: "TC requested for Grade 9 student relocating; records verified and ready to sign.",
          category: "certificate",
          priority: "low",
          dueLabel: "Due tomorrow",
          requestedBy: "Registrar's Office",
        },
        {
          id: "a6",
          title: "Publish results — Grade 10 Science",
          description: "Unit test results compiled and ready to publish to parents and students.",
          category: "result-publication",
          priority: "medium",
          dueLabel: "Due today",
          requestedBy: "James Okoye",
        },
        {
          id: "a7",
          title: "Approve purchase — Lab equipment",
          description: "Requested budget of ₹42,000 for Grade 9-10 chemistry lab restocking.",
          category: "purchase",
          priority: "low",
          dueLabel: "Due next week",
          requestedBy: "Priya Sharma",
        },
      ],
    },
    600,
  );
}

export async function fetchAttendance(): Promise<AttendanceData> {
  return delay(
    {
      overallPercent: 94,
      yesterdayPercent: 91,
      present: 1128,
      absent: 52,
      late: 18,
      totalStudents: 1198,
      byGrade: [
        { grade: "Grade 6", percent: 96 },
        { grade: "Grade 7", percent: 93 },
        { grade: "Grade 8", percent: 91 },
        { grade: "Grade 9", percent: 95 },
        { grade: "Grade 10", percent: 97 },
      ],
    },
    550,
  );
}

export async function fetchFeeCollection(): Promise<FeeCollectionData> {
  return delay(
    {
      collectedPercent: 78,
      collectedAmount: 840000,
      pendingAmount: 165000,
      overdueAmount: 75000,
      targetAmount: 1080000,
      overdueInvoices: 23,
      trend: [52, 58, 55, 63, 68, 71, 78],
      recentPayments: [
        { id: "p1", studentName: "Ishaan Bhatt", grade: "Grade 7", amount: 18500, method: "UPI", time: "10 min ago" },
        { id: "p2", studentName: "Sara Fernandes", grade: "Grade 4", amount: 22000, method: "Card", time: "42 min ago" },
        { id: "p3", studentName: "Vihaan Joshi", grade: "Grade 9", amount: 18500, method: "Bank Transfer", time: "1h ago" },
        { id: "p4", studentName: "Diya Kapoor", grade: "Grade 2", amount: 15000, method: "Cash", time: "2h ago" },
      ],
    },
    650,
  );
}

export async function fetchStaffAvailability(): Promise<StaffAvailabilityData> {
  return delay(
    {
      totalStaff: 86,
      present: 78,
      absent: 3,
      onLeave: 5,
      late: 4,
      staff: [
        { id: "s1", name: "Priya Sharma", role: "Mathematics", status: "in", initials: "PS" },
        { id: "s2", name: "James Okoye", role: "Science", status: "in", initials: "JO" },
        { id: "s3", name: "Rajesh Kumar", role: "Physics", status: "leave", initials: "RK" },
        { id: "s4", name: "Anita Desai", role: "Front Office", status: "late", initials: "AD" },
        { id: "s5", name: "Meena Iyer", role: "Admin", status: "absent", initials: "MI" },
        { id: "s6", name: "Kavita Rao", role: "English", status: "in", initials: "KR" },
        { id: "s7", name: "David Chen", role: "History", status: "leave", initials: "DC" },
      ],
      substituteRequirements: [
        {
          id: "sub1",
          className: "Grade 9B",
          subject: "Physics",
          coveringFor: "Rajesh Kumar",
          status: "unfilled",
        },
        {
          id: "sub2",
          className: "Grade 6A",
          subject: "History",
          coveringFor: "David Chen",
          status: "assigned",
          substituteName: "Kavita Rao",
        },
        {
          id: "sub3",
          className: "Grade 4C",
          subject: "Admin period",
          coveringFor: "Meena Iyer",
          status: "unfilled",
        },
      ],
    },
    500,
  );
}

export async function fetchTransportStatus(): Promise<TransportStatusData> {
  return delay(
    {
      routes: [
        { id: "r1", name: "Route 1 — Westside Loop", status: "on-time", etaMinutes: 8, studentsOnboard: 34 },
        { id: "r2", name: "Route 4 — North Loop", status: "delayed", etaMinutes: 22, studentsOnboard: 41 },
        { id: "r3", name: "Route 7 — Lakeview", status: "on-time", etaMinutes: 12, studentsOnboard: 28 },
        { id: "r4", name: "Route 2 — Hillcrest", status: "issue", etaMinutes: 0, studentsOnboard: 19 },
        { id: "r5", name: "Route 3 — Riverside", status: "completed", etaMinutes: 0, studentsOnboard: 0 },
        { id: "r6", name: "Route 5 — East End", status: "completed", etaMinutes: 0, studentsOnboard: 0 },
      ],
      maintenanceAlerts: [
        { id: "m1", busId: "Bus 07 (Route 2)", issue: "Mechanical issue near Hillcrest junction", reportedAgo: "12 min ago" },
        { id: "m2", busId: "Bus 12 (Route 4)", issue: "Brake inspection overdue", reportedAgo: "3h ago" },
      ],
    },
    600,
  );
}

export async function fetchExceptionFeed(): Promise<ExceptionFeedData> {
  return delay(
    {
      items: [
        {
          id: "e1",
          title: "Route 2 bus breakdown reported",
          description: "Driver reported a mechanical issue near Hillcrest junction. Backup vehicle dispatched.",
          severity: "critical",
          category: "transport",
          time: "12 min ago",
          source: "Transport",
        },
        {
          id: "e2",
          title: "Class 8B attendance below threshold",
          description: "Attendance (68%) is more than 20 points below the school-wide average of 94%.",
          severity: "critical",
          category: "attendance",
          time: "25 min ago",
          source: "Academics",
        },
        {
          id: "e3",
          title: "42 fee payments now overdue",
          description: "42 invoices have crossed their due date by more than 15 days, totalling ₹3.1L.",
          severity: "warning",
          category: "fees",
          time: "38 min ago",
          source: "Finance",
        },
        {
          id: "e4",
          title: "Missing admission documents — Kabir Singh",
          description: "Birth certificate and address proof still pending for Grade 3 application.",
          severity: "warning",
          category: "documents",
          time: "1h ago",
          source: "Admissions",
        },
        {
          id: "e5",
          title: "Timetable conflict — Room 204",
          description: "Mathematics (Grade 6) and Art (Grade 9) are both scheduled in Room 204 at 11:30.",
          severity: "warning",
          category: "timetable",
          time: "1h ago",
          source: "Academics",
        },
        {
          id: "e6",
          title: "Lab chemical stock below reorder level",
          description: "Sodium bicarbonate and litmus paper are below the minimum stock threshold.",
          severity: "info",
          category: "inventory",
          time: "2h ago",
          source: "Inventory",
        },
        {
          id: "e7",
          title: "Grade 10 Science results not yet entered",
          description: "Unit test marks for 2 of 6 sections are still pending entry, due end of day.",
          severity: "info",
          category: "results",
          time: "3h ago",
          source: "Academics",
        },
      ],
    },
    550,
  );
}

export async function fetchTodaysTimetable(): Promise<TodaysTimetableData> {
  return delay(
    {
      slots: [
        { id: "t1", time: "9:00 – 9:45", subject: "Mathematics", teacher: "Priya Sharma", room: "Room 204", status: "completed" },
        { id: "t2", time: "9:45 – 10:30", subject: "Science", teacher: "James Okoye", room: "Lab 1", status: "current" },
        { id: "t3", time: "10:30 – 11:15", subject: "English", teacher: "Kavita Rao", room: "Room 112", status: "upcoming" },
        {
          id: "t4",
          time: "11:30 – 12:15",
          subject: "Physics",
          teacher: "Rajesh Kumar",
          room: "Lab 2",
          status: "upcoming",
        },
        {
          id: "t5",
          time: "11:30 – 12:15",
          subject: "Art",
          teacher: "Kavita Rao",
          room: "Room 204",
          status: "upcoming",
          conflict: "Room 204 double-booked with Grade 6 Mathematics",
        },
        { id: "t6", time: "12:15 – 1:00", subject: "History", teacher: "David Chen", room: "Room 108", status: "upcoming" },
      ],
    },
    450,
  );
}

export async function fetchUpcomingEvents(): Promise<UpcomingEventsData> {
  return delay(
    {
      events: [
        { id: "ev1", title: "Mid-Term Exams Begin", date: "14 Aug", time: "9:00 AM", location: "All Classrooms", category: "exam" },
        { id: "ev2", title: "Independence Day", date: "15 Aug", time: "All day", location: "Campus-wide", category: "holiday" },
        { id: "ev3", title: "PTA Meeting — Grade 8", date: "18 Aug", time: "5:00 PM", location: "Room 204", category: "ptm" },
        { id: "ev4", title: "Annual Cultural Fest", date: "22 Aug", time: "9:00 AM", location: "Auditorium", category: "celebration" },
        { id: "ev5", title: "Staff Meeting", date: "25 Aug", time: "4:00 PM", location: "Conference Room", category: "meeting" },
        { id: "ev6", title: "Term fee payment deadline", date: "31 Aug", time: "End of day", location: "Online / Front Office", category: "deadline" },
      ],
    },
    500,
  );
}
