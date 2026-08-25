import type { LucideIcon } from "lucide-react";
import {
  ArrowUpCircle,
  Award,
  BadgeCheck,
  BarChart3,
  Bell,
  BookOpenCheck,
  Boxes,
  Briefcase,
  Bus,
  Calculator,
  Calendar,
  CalendarCheck,
  Command,
  CalendarClock,
  CalendarPlus,
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  DoorOpen,
  FileBadge,
  FileStack,
  FileText,
  GraduationCap,
  HandCoins,
  HandHeart,
  HeartPulse,
  Hotel,
  IdCard,
  Inbox,
  LayoutDashboard,
  Library,
  LifeBuoy,
  Files,
  FileSignature,
  LayoutTemplate,
  Medal,
  Megaphone,
  MessageSquare,
  NotebookPen,
  PartyPopper,
  Plug,
  Presentation,
  Printer,
  QrCode,
  ScrollText,
  Settings,
  Shield,
  Sparkles,
  Trophy,
  UserPlus,
  UtensilsCrossed,
  Users,
  Users2,
  Volleyball,
  Wallet,
} from "lucide-react";

export type NavItem = {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /** Static pending-count badge, for a future item with no live data source yet.
   * The "notifications" item is special-cased in NavLink to show the real
   * unread count instead — this field is never used for it. */
  badge?: number;
  /**
   * Real capability key(s) gating this item's visibility, matching exactly
   * the key the destination route itself checks (see use-nav-access.ts).
   * A string[] means "visible if ANY key is granted" (canAny semantics).
   * Omitted = no real permission backs this destination yet (e.g. My Day,
   * Notifications, Reports hub, Helpdesk) — left visible to any
   * authenticated user rather than fabricating a gate.
   */
  permission?: string | string[];
  /** Only ever visible to platform (Super Admin) staff — a real identity
   * boundary (SA-1), not a tenant permission key. */
  platformOnly?: boolean;
};

export type NavGroup = {
  key: string;
  label: string;
  items: NavItem[];
};

// Placeholder IA — routes below don't exist yet, this is shell/nav scaffolding only.
export const navGroups: NavGroup[] = [
  {
    key: "main",
    label: "Main",
    items: [
      { key: "dashboard", label: "Dashboard", href: "/", icon: LayoutDashboard },
      { key: "my-day", label: "My Day", href: "/teacher/my-day", icon: CalendarCheck },
      { key: "action-inbox", label: "Action Inbox", href: "/action-inbox", icon: Inbox, permission: "dashboard.view" },
      { key: "calendar", label: "Calendar", href: "/academics/calendar", icon: Calendar, permission: "calendar.view" },
      { key: "notifications", label: "Notifications", href: "/notifications", icon: Bell },
    ],
  },
  {
    key: "people",
    label: "People",
    items: [
      { key: "students", label: "Students", href: "/students", icon: GraduationCap, permission: "students.view" },
      { key: "parents", label: "Parents", href: "/parents", icon: Users, permission: "guardians.view" },
      { key: "teachers", label: "Teachers", href: "/teachers", icon: Presentation, permission: "hr.view" },
      { key: "staff", label: "Staff", href: "/hr/staff", icon: Briefcase, permission: "hr.view" },
      { key: "admissions", label: "Admissions", href: "/admissions", icon: UserPlus, permission: "admissions.view" },
      { key: "visitors", label: "Visitors", href: "/front-desk/visitors", icon: DoorOpen, permission: "visitors.view" },
    ],
  },
  {
    key: "academics",
    label: "Academics",
    items: [
      { key: "academics-home", label: "Academics", href: "/academics", icon: LayoutDashboard, permission: "academics.view" },
      { key: "classes", label: "Classes", href: "/academics/classes", icon: Presentation, permission: "academics.view" },
      { key: "subjects", label: "Subjects", href: "/academics/subjects", icon: NotebookPen, permission: "academics.view" },
      { key: "curriculum", label: "Curriculum", href: "/academics/curriculum", icon: BookOpenCheck, permission: "curriculum.view" },
      { key: "lesson-plans", label: "Lesson Plans", href: "/academics/lesson-plans", icon: ClipboardList, permission: "lessonPlans.view" },
      { key: "timetable", label: "Timetable", href: "/academics/timetable", icon: CalendarClock, permission: "timetable.view" },
      { key: "attendance", label: "Attendance", href: "/attendance", icon: ClipboardCheck, permission: "attendance.view" },
      { key: "homework", label: "Homework", href: "/academics/homework", icon: FileText, permission: "homework.view" },
      { key: "calendar-academic", label: "Academic Calendar", href: "/academics/calendar", icon: CalendarRange, permission: "calendar.view" },
      { key: "exams", label: "Exams", href: "/exams", icon: FileBadge, permission: "exams.view" },
      { key: "results", label: "Results", href: "/results", icon: Award, permission: "results.view" },
      { key: "grading", label: "Grading", href: "/grading/schemes", icon: BadgeCheck, permission: "results.view" },
      { key: "report-cards", label: "Report Cards", href: "/report-cards", icon: FileStack, permission: "results.view" },
      { key: "promotion", label: "Promotion", href: "/promotion", icon: ArrowUpCircle, permission: "promotion.view" },
    ],
  },
  {
    key: "operations",
    label: "Operations",
    items: [
      { key: "fees", label: "Fees", href: "/fees", icon: Wallet, permission: "fees.view" },
      { key: "accounting", label: "Accounting", href: "/accounting", icon: Calculator, permission: "accounting.view" },
      { key: "payroll", label: "Payroll", href: "/payroll", icon: HandCoins, permission: "payroll.view" },
      { key: "transport", label: "Transport", href: "/transport", icon: Bus, permission: "transport.view" },
      { key: "library", label: "Library", href: "/library", icon: Library, permission: "library.view" },
      { key: "inventory", label: "Inventory", href: "/inventory", icon: Boxes, permission: "inventory.view" },
      { key: "assets", label: "Assets", href: "/assets", icon: Boxes, permission: "assets.view" },
      { key: "hr", label: "HR", href: "/hr", icon: IdCard, permission: "hr.view" },
    ],
  },
  {
    key: "campus-life",
    label: "Student Life",
    items: [
      {
        key: "student-life",
        label: "Campus Services",
        href: "/campus-life",
        icon: LayoutDashboard,
        permission: ["hostel.view", "health.view", "counseling.view", "cafeteria.view"],
      },
      { key: "hostel", label: "Hostel", href: "/hostel", icon: Hotel, permission: "hostel.view" },
      { key: "health", label: "Health", href: "/health", icon: HeartPulse, permission: "health.view" },
      { key: "counselling", label: "Counselling", href: "/counselling", icon: HandHeart, permission: "counseling.view" },
      { key: "cafeteria", label: "Cafeteria", href: "/cafeteria", icon: UtensilsCrossed, permission: "cafeteria.view" },
    ],
  },
  {
    key: "activities",
    label: "Activities",
    items: [
      { key: "activities-home", label: "Activities", href: "/activities", icon: Sparkles, permission: "activities.view" },
      { key: "events", label: "Events", href: "/activities/events", icon: PartyPopper, permission: "activities.view" },
      { key: "events-calendar", label: "Event Calendar", href: "/activities/events/calendar", icon: Calendar, permission: "activities.view" },
      { key: "clubs", label: "Clubs", href: "/activities/clubs", icon: Users2, permission: "activities.view" },
      { key: "sports", label: "Sports", href: "/activities/sports", icon: Volleyball, permission: "activities.view" },
      { key: "competitions", label: "Competitions", href: "/activities/competitions", icon: Medal, permission: "activities.view" },
      { key: "houses", label: "House System", href: "/activities/houses", icon: Shield, permission: "activities.view" },
      { key: "leaderboard", label: "House Leaderboard", href: "/activities/houses/leaderboard", icon: Trophy, permission: "activities.view" },
      { key: "achievements", label: "Achievements", href: "/activities/achievements", icon: Award, permission: "activities.view" },
      { key: "awards", label: "Awards", href: "/activities/awards", icon: Trophy, permission: "activities.view" },
      { key: "activity-certificates", label: "Certificates", href: "/activities/certificates", icon: FileBadge, permission: "activities.view" },
      { key: "activities-analytics", label: "Analytics", href: "/activities/analytics", icon: BarChart3, permission: "activities.view" },
    ],
  },
  {
    key: "document-studio",
    label: "Document Studio",
    items: [
      { key: "documents", label: "Document Studio", href: "/documents", icon: Files, permission: "documents.view" },
      { key: "doc-templates", label: "Templates", href: "/documents/templates", icon: LayoutTemplate, permission: "documents.view" },
      { key: "doc-generate", label: "Generate", href: "/documents/generate", icon: Sparkles, permission: "documents.generate" },
      { key: "doc-batch", label: "Batch", href: "/documents/batch", icon: FileStack, permission: "documents.view" },
      { key: "id-cards", label: "ID Cards", href: "/id-cards", icon: IdCard, permission: "documents.view" },
      { key: "doc-certificates", label: "Certificates", href: "/certificates", icon: FileBadge, permission: "documents.view" },
      { key: "letters", label: "Letters", href: "/letters", icon: ScrollText, permission: "documents.view" },
      { key: "admit-cards", label: "Admit Cards", href: "/admit-cards", icon: FileSignature, permission: "documents.view" },
      { key: "print-queue", label: "Print Centre", href: "/documents/print-queue", icon: Printer, permission: "documents.view" },
      { key: "doc-verification", label: "Verification", href: "/documents/verification", icon: QrCode, permission: "documents.view" },
      { key: "doc-history", label: "History", href: "/documents/history", icon: Files, permission: "documents.view" },
    ],
  },
  {
    key: "more",
    label: "More",
    items: [
      { key: "communication", label: "Communication", href: "/communication", icon: MessageSquare, permission: "comm.view" },
      { key: "helpdesk", label: "Helpdesk", href: "/helpdesk", icon: LifeBuoy },
      { key: "front-desk", label: "Front Desk", href: "/front-desk", icon: DoorOpen, permission: "frontdesk.view" },
      { key: "reports", label: "Reports", href: "/reports", icon: BarChart3 },
      { key: "integrations", label: "Integrations", href: "/settings/integrations", icon: Plug, permission: "settings.view" },
      { key: "settings", label: "Settings", href: "/settings", icon: Settings, permission: "settings.view" },
      { key: "super-admin", label: "SaaS Control Center", href: "/super-admin", icon: Command, platformOnly: true },
    ],
  },
];

export const allNavItems = navGroups.flatMap((group) => group.items);

// Bottom nav can only show 4 destinations + "More" — these are fixed shortcuts
// into the grouped IA (People/Academics link to that group's first page),
// not a subset toggle, since the full IA is too deep to flatten onto 5 tabs.
export const mobileBottomNavItems: NavItem[] = [
  { key: "home", label: "Home", href: "/", icon: LayoutDashboard },
  { key: "my-day", label: "My Day", href: "/teacher/my-day", icon: CalendarCheck },
  { key: "people", label: "People", href: "/students", icon: Users, permission: "students.view" },
  { key: "academics", label: "Academics", href: "/academics", icon: Presentation, permission: "academics.view" },
];

export type CreateAction = {
  key: string;
  label: string;
  icon: LucideIcon;
  /** Real capability key required to perform this action — see NavItem.permission. */
  permission: string;
};

export const createActions: CreateAction[] = [
  { key: "student", label: "Add student", icon: GraduationCap, permission: "students.create" },
  { key: "teacher", label: "Add teacher", icon: Presentation, permission: "users.manage" },
  { key: "payment", label: "Record payment", icon: Wallet, permission: "fees.collect" },
  { key: "announcement", label: "Create announcement", icon: Megaphone, permission: "comm.manageAnnouncements" },
  { key: "homework", label: "Create homework", icon: FileText, permission: "homework.manage" },
  { key: "exam", label: "Schedule exam", icon: FileBadge, permission: "exams.manage" },
  { key: "event", label: "Add event", icon: CalendarPlus, permission: "activities.manage" },
  { key: "certificate", label: "Create certificate", icon: BadgeCheck, permission: "documents.generate" },
];

export type Breadcrumb = { groupLabel?: string; pageLabel: string };

export function getBreadcrumb(pathname: string): Breadcrumb {
  if (pathname === "/") return { pageLabel: "Dashboard" };
  for (const group of navGroups) {
    const match = group.items.find((item) => item.href === pathname || pathname.startsWith(`${item.href}/`));
    if (match) return { groupLabel: group.label, pageLabel: match.label };
  }
  return { pageLabel: "Novyra Campus OS" };
}
