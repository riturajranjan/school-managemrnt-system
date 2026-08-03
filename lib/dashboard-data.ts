import type { LucideIcon } from "lucide-react"
import {
  LayoutDashboard,
  Radio,
  GraduationCap,
  Users,
  School,
  CalendarCheck,
  CalendarClock,
  FileSpreadsheet,
  Wallet,
  Bus,
  BookOpen,
  MessageSquare,
  Megaphone,
  Sparkles,
  BarChart3,
  Settings,
  UserPlus,
  ClipboardCheck,
  ReceiptText,
  FilePlus2,
} from "lucide-react"

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  badge?: string
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const navGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { label: "Command Center", href: "/", icon: LayoutDashboard },
      { label: "Live Campus", href: "/live-campus", icon: Radio },
    ],
  },
  {
    label: "Academics",
    items: [
      { label: "Students", href: "/students", icon: GraduationCap },
      { label: "Teachers", href: "/teachers", icon: Users },
      { label: "Classes", href: "/classes", icon: School },
      { label: "Attendance", href: "/attendance", icon: CalendarCheck },
      { label: "Timetable", href: "/timetable", icon: CalendarClock },
      { label: "Exams", href: "/exams", icon: FileSpreadsheet },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Fees & Finance", href: "/finance", icon: Wallet },
      { label: "Transport", href: "/transport", icon: Bus },
      { label: "Library", href: "/library", icon: BookOpen },
    ],
  },
  {
    label: "Communication",
    items: [
      { label: "Messages", href: "/messages", icon: MessageSquare, badge: "3" },
      { label: "Announcements", href: "/announcements", icon: Megaphone },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { label: "Nexa AI", href: "/nexa", icon: Sparkles },
      { label: "Reports", href: "/reports", icon: BarChart3 },
    ],
  },
  {
    label: "System",
    items: [{ label: "Settings", href: "/settings", icon: Settings }],
  },
]

// ---------------------------------------------------------------------------
// School / session context
// ---------------------------------------------------------------------------

export interface SchoolProfile {
  name: string
  crestInitials: string
  academicSession: string
}

export const currentSchool: SchoolProfile = {
  name: "Horizon International School",
  crestInitials: "HIS",
  academicSession: "2026–27",
}

export interface Principal {
  name: string
  role: string
  initials: string
}

export const principal: Principal = {
  name: "Dr. Meera Kapoor",
  role: "Principal",
  initials: "MK",
}

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

export interface HeroQuickAction {
  label: string
  icon: LucideIcon
}

export const heroSummary =
  "Attendance is healthy today. Two buses are delayed, three fee follow-ups need attention, and Class 10 performance improved this week."

export const heroQuickActions: HeroQuickAction[] = [
  { label: "Review AI brief", icon: Sparkles },
  { label: "Create announcement", icon: Megaphone },
  { label: "Open live campus", icon: Radio },
]

// ---------------------------------------------------------------------------
// Card 1 — Live Attendance Pulse
// ---------------------------------------------------------------------------

export interface AttendancePulse {
  present: number
  totalStudents: number
  attendanceRate: number
  absent: number
  late: number
  improvementFromYesterday: number
  trend: number[]
}

export const attendancePulse: AttendancePulse = {
  present: 1842,
  totalStudents: 1911,
  attendanceRate: 96.4,
  absent: 43,
  late: 19,
  improvementFromYesterday: 1.8,
  trend: [91.2, 92.4, 93.1, 92.8, 94.6, 95.3, 96.4],
}

// ---------------------------------------------------------------------------
// Card 2 — Nexa AI Morning Brief
// ---------------------------------------------------------------------------

export type InsightPriority = "high" | "medium" | "low"

export interface AIInsight {
  id: string
  label: string
  detail: string
  priority: InsightPriority
}

export const aiMorningInsights: AIInsight[] = [
  {
    id: "buses-delayed",
    label: "2 buses delayed",
    detail: "Route 04 and Route 11 are running 12-18 minutes behind schedule.",
    priority: "medium",
  },
  {
    id: "fee-followups",
    label: "3 fee follow-ups",
    detail: "High-priority balances are overdue by more than 15 days.",
    priority: "high",
  },
  {
    id: "substitution",
    label: "1 substitution needed",
    detail: "Class 8B Physics, Period 4 — Mr. Rao is on leave.",
    priority: "medium",
  },
  {
    id: "attendance-risk",
    label: "5 students at risk",
    detail: "Attendance has dropped below 75% in the last two weeks.",
    priority: "low",
  },
]

// ---------------------------------------------------------------------------
// Card 3 — Campus Activity timeline
// ---------------------------------------------------------------------------

export type ActivityStatus = "success" | "info" | "warning"

export interface ActivityEvent {
  id: string
  time: string
  label: string
  status: ActivityStatus
}

export const campusActivity: ActivityEvent[] = [
  { id: "gate", time: "8:05 AM", label: "Main gate opened", status: "info" },
  { id: "bus", time: "8:18 AM", label: "Bus Route 04 arrived", status: "success" },
  { id: "assembly", time: "8:30 AM", label: "Morning assembly completed", status: "success" },
  { id: "period", time: "8:45 AM", label: "First period started", status: "info" },
  { id: "payment", time: "9:10 AM", label: "Fee payment received", status: "success" },
]

// ---------------------------------------------------------------------------
// Card 4 — Fee Collection
// ---------------------------------------------------------------------------

export interface FeeCollection {
  collectedLakh: number
  pendingLakh: number
  monthlyTargetPercent: number
  forecastLakh: number
  monthlyTrend: number[]
}

export const feeCollection: FeeCollection = {
  collectedLakh: 24.8,
  pendingLakh: 6.2,
  monthlyTargetPercent: 80,
  forecastLakh: 29.4,
  monthlyTrend: [14.2, 16.8, 19.1, 20.4, 22.6, 24.8],
}

// ---------------------------------------------------------------------------
// Card 5 — Academic Health
// ---------------------------------------------------------------------------

export interface AcademicHealth {
  overallScore: number
  weeklyChange: number
  strongestSubject: string
  weakestSubject: string
  studentsNeedingAttention: number
  trend: number[]
}

export const academicHealth: AcademicHealth = {
  overallScore: 82.6,
  weeklyChange: 2.1,
  strongestSubject: "Mathematics",
  weakestSubject: "Chemistry",
  studentsNeedingAttention: 12,
  trend: [77.4, 78.9, 79.5, 80.6, 81.2, 82.6],
}

// ---------------------------------------------------------------------------
// Card 6 — Today's Timetable
// ---------------------------------------------------------------------------

export interface TimetableSlot {
  id: string
  period: string
  time: string
  className: string
  subject: string
  teacher: string
  room: string
  isCurrent: boolean
  isSubstitution: boolean
}

export const todayTimetable: TimetableSlot[] = [
  {
    id: "p4",
    period: "Period 4",
    time: "10:45 – 11:30 AM",
    className: "Class 10 – A",
    subject: "Physics",
    teacher: "Mrs. Anjali Sen",
    room: "Lab 2",
    isCurrent: true,
    isSubstitution: false,
  },
  {
    id: "p5",
    period: "Period 5",
    time: "11:35 – 12:20 PM",
    className: "Class 8 – B",
    subject: "Physics",
    teacher: "Ms. Divya Menon",
    room: "Room 14",
    isCurrent: false,
    isSubstitution: true,
  },
  {
    id: "p6",
    period: "Period 6",
    time: "12:25 – 1:10 PM",
    className: "Class 10 – A",
    subject: "English",
    teacher: "Mr. Rohan Das",
    room: "Room 09",
    isCurrent: false,
    isSubstitution: false,
  },
]

// ---------------------------------------------------------------------------
// Card 7 — Transport Status
// ---------------------------------------------------------------------------

export interface TransportRoute {
  id: string
  route: string
  status: "on-time" | "delayed" | "arriving"
  x: number
  y: number
}

export interface TransportStatus {
  activeBuses: number
  delayed: number
  arrivingSoon: number
  routes: TransportRoute[]
}

export const transportStatus: TransportStatus = {
  activeBuses: 18,
  delayed: 2,
  arrivingSoon: 1,
  routes: [
    { id: "r1", route: "Route 01", status: "on-time", x: 18, y: 32 },
    { id: "r2", route: "Route 04", status: "delayed", x: 42, y: 58 },
    { id: "r3", route: "Route 07", status: "on-time", x: 64, y: 24 },
    { id: "r4", route: "Route 09", status: "arriving", x: 78, y: 62 },
    { id: "r5", route: "Route 11", status: "delayed", x: 30, y: 74 },
  ],
}

// ---------------------------------------------------------------------------
// Card 8 — Upcoming Events
// ---------------------------------------------------------------------------

export type EventCategory = "meeting" | "exhibition" | "exam" | "holiday"

export interface UpcomingEvent {
  id: string
  title: string
  date: string
  day: string
  category: EventCategory
}

export const upcomingEvents: UpcomingEvent[] = [
  { id: "ptm", title: "Parent-Teacher Meeting", date: "Aug 8", day: "Sat", category: "meeting" },
  { id: "sci", title: "Science Exhibition", date: "Aug 14", day: "Fri", category: "exhibition" },
  { id: "mid", title: "Mid-Term Examination", date: "Aug 22", day: "Sat", category: "exam" },
  { id: "hol", title: "School Holiday", date: "Aug 30", day: "Sun", category: "holiday" },
]

// ---------------------------------------------------------------------------
// Card 9 — Quick Actions
// ---------------------------------------------------------------------------

export interface QuickAction {
  id: string
  label: string
  icon: LucideIcon
  shortcut?: string
}

export const quickActions: QuickAction[] = [
  { id: "add-student", label: "Add student", icon: UserPlus, shortcut: "A" },
  { id: "mark-attendance", label: "Mark attendance", icon: ClipboardCheck, shortcut: "M" },
  { id: "record-payment", label: "Record payment", icon: ReceiptText, shortcut: "P" },
  { id: "create-announcement", label: "Create announcement", icon: Megaphone, shortcut: "N" },
  { id: "schedule-exam", label: "Schedule exam", icon: FileSpreadsheet, shortcut: "E" },
  { id: "generate-report", label: "Generate report", icon: FilePlus2, shortcut: "R" },
]

// ---------------------------------------------------------------------------
// Global search
// ---------------------------------------------------------------------------

export interface SearchSuggestion {
  id: string
  label: string
  group: string
  icon: LucideIcon
}

export const recentSearches: SearchSuggestion[] = [
  { id: "recent-1", label: "Aarav Sharma – Class 9B", group: "Recent", icon: GraduationCap },
  { id: "recent-2", label: "Fee ledger – July", group: "Recent", icon: Wallet },
]

export const quickSearchActions: SearchSuggestion[] = [
  { id: "qs-1", label: "Add a new student", group: "Quick actions", icon: UserPlus },
  { id: "qs-2", label: "Mark today's attendance", group: "Quick actions", icon: ClipboardCheck },
  { id: "qs-3", label: "Record a fee payment", group: "Quick actions", icon: ReceiptText },
]
