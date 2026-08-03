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
      greetingName: "Alex",
      summary:
        "Attendance is tracking 3% above last Monday and fee collection is ahead of target. Two items need your approval before noon.",
      generatedAt: "Today, 7:45 AM",
      priorities: [
        { id: "p1", label: "Approve 2 pending staff leave requests", tone: "warning" },
        { id: "p2", label: "Route 4 bus running 15 minutes late", tone: "error" },
        { id: "p3", label: "Mid-term results ready for Grade 10 review", tone: "info" },
      ],
    },
    500,
  );
}

export async function fetchSchoolPulse(): Promise<SchoolPulseData> {
  return delay(
    {
      metrics: [
        { key: "attendance", label: "Attendance today", value: "94.2%", delta: "+3.1%", trend: "up", tone: "success" },
        { key: "fees", label: "Fees collected", value: "₹8.4L", delta: "+12%", trend: "up", tone: "success" },
        { key: "incidents", label: "Open exceptions", value: "4", delta: "+2", trend: "up", tone: "warning" },
        { key: "staff", label: "Staff present", value: "91%", delta: "-2%", trend: "down", tone: "info" },
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
          category: "Staff",
          priority: "high",
          dueLabel: "Due today",
          requestedBy: "Rajesh Kumar",
        },
        {
          id: "a2",
          title: "Approve leave — Meena Iyer",
          description: "Front office staff requesting half-day leave this afternoon.",
          category: "Staff",
          priority: "medium",
          dueLabel: "Due today",
          requestedBy: "Meena Iyer",
        },
        {
          id: "a3",
          title: "Review admission — Kabir Singh",
          description: "Grade 3 admission application awaiting document verification.",
          category: "Admissions",
          priority: "medium",
          dueLabel: "Due tomorrow",
          requestedBy: "Admissions Office",
        },
        {
          id: "a4",
          title: "Sign off transport route change",
          description: "Route 7 proposed to add a stop at Lakeview Colony.",
          category: "Transport",
          priority: "low",
          dueLabel: "Due Friday",
          requestedBy: "Transport Desk",
        },
        {
          id: "a5",
          title: "Approve budget — Science Fair",
          description: "Requested budget of ₹42,000 for Grade 6-8 science fair materials.",
          category: "Finance",
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
      targetAmount: 1080000,
      overdueInvoices: 23,
      trend: [52, 58, 55, 63, 68, 71, 78],
    },
    650,
  );
}

export async function fetchStaffAvailability(): Promise<StaffAvailabilityData> {
  return delay(
    {
      totalStaff: 86,
      present: 78,
      onLeave: 5,
      late: 3,
      staff: [
        { id: "s1", name: "Priya Sharma", role: "Mathematics", status: "in", initials: "PS" },
        { id: "s2", name: "James Okoye", role: "Science", status: "in", initials: "JO" },
        { id: "s3", name: "Rajesh Kumar", role: "Physics", status: "leave", initials: "RK" },
        { id: "s4", name: "Anita Desai", role: "Front Office", status: "late", initials: "AD" },
        { id: "s5", name: "Meena Iyer", role: "Admin", status: "out", initials: "MI" },
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
          time: "12 min ago",
          source: "Transport",
        },
        {
          id: "e2",
          title: "Grade 8B attendance not marked",
          description: "Homeroom attendance for Grade 8B has not been submitted for today.",
          severity: "warning",
          time: "38 min ago",
          source: "Academics",
        },
        {
          id: "e3",
          title: "Library book overdue threshold reached",
          description: "14 books are now more than 30 days overdue.",
          severity: "info",
          time: "1h ago",
          source: "Library",
        },
        {
          id: "e4",
          title: "Cafeteria occupancy unusually low",
          description: "Only 12% occupancy recorded during lunch period — sensor check recommended.",
          severity: "warning",
          time: "2h ago",
          source: "Facilities",
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
        { id: "t1", time: "9:00 – 9:45", subject: "Mathematics", teacher: "Priya Sharma", room: "Room 204", isNow: false },
        { id: "t2", time: "9:45 – 10:30", subject: "Science", teacher: "James Okoye", room: "Lab 1", isNow: true },
        { id: "t3", time: "10:30 – 11:15", subject: "English", teacher: "Kavita Rao", room: "Room 112", isNow: false },
        { id: "t4", time: "11:30 – 12:15", subject: "Physics", teacher: "Rajesh Kumar", room: "Lab 2", isNow: false },
        { id: "t5", time: "12:15 – 1:00", subject: "History", teacher: "David Chen", room: "Room 108", isNow: false },
      ],
    },
    450,
  );
}

export async function fetchUpcomingEvents(): Promise<UpcomingEventsData> {
  return delay(
    {
      events: [
        { id: "ev1", title: "Science Fair", date: "14 Aug", time: "10:00 AM", location: "Main Hall", category: "academic" },
        { id: "ev2", title: "Inter-house Football", date: "16 Aug", time: "3:00 PM", location: "Sports Ground", category: "sports" },
        { id: "ev3", title: "PTA Meeting — Grade 8", date: "18 Aug", time: "5:00 PM", location: "Room 204", category: "meeting" },
        { id: "ev4", title: "Annual Cultural Fest", date: "22 Aug", time: "9:00 AM", location: "Auditorium", category: "cultural" },
      ],
    },
    500,
  );
}
