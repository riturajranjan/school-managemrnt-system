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
  /** Illustrative unread/pending count. Omitted unless there's something to surface. */
  badge?: number;
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
      { key: "action-inbox", label: "Action Inbox", href: "/inbox", icon: Inbox, badge: 5 },
      { key: "calendar", label: "Calendar", href: "/calendar", icon: Calendar },
      { key: "notifications", label: "Notifications", href: "/notifications", icon: Bell, badge: 3 },
    ],
  },
  {
    key: "people",
    label: "People",
    items: [
      { key: "students", label: "Students", href: "/students", icon: GraduationCap },
      { key: "parents", label: "Parents", href: "/parents", icon: Users },
      { key: "teachers", label: "Teachers", href: "/teachers", icon: Presentation },
      { key: "staff", label: "Staff", href: "/people/staff", icon: Briefcase },
      { key: "admissions", label: "Admissions", href: "/admissions", icon: UserPlus },
      { key: "visitors", label: "Visitors", href: "/people/visitors", icon: DoorOpen },
    ],
  },
  {
    key: "academics",
    label: "Academics",
    items: [
      { key: "academics-home", label: "Academics", href: "/academics", icon: LayoutDashboard },
      { key: "classes", label: "Classes", href: "/academics/classes", icon: Presentation },
      { key: "subjects", label: "Subjects", href: "/academics/subjects", icon: NotebookPen },
      { key: "curriculum", label: "Curriculum", href: "/academics/curriculum", icon: BookOpenCheck },
      { key: "lesson-plans", label: "Lesson Plans", href: "/academics/lesson-plans", icon: ClipboardList },
      { key: "timetable", label: "Timetable", href: "/academics/timetable", icon: CalendarClock },
      { key: "attendance", label: "Attendance", href: "/attendance", icon: ClipboardCheck },
      { key: "homework", label: "Homework", href: "/academics/homework", icon: FileText },
      { key: "calendar-academic", label: "Academic Calendar", href: "/academics/calendar", icon: CalendarRange },
      { key: "exams", label: "Exams", href: "/exams", icon: FileBadge },
      { key: "results", label: "Results", href: "/results", icon: Award },
      { key: "grading", label: "Grading", href: "/grading/schemes", icon: BadgeCheck },
      { key: "report-cards", label: "Report Cards", href: "/report-cards", icon: FileStack },
      { key: "promotion", label: "Promotion", href: "/promotion", icon: ArrowUpCircle },
    ],
  },
  {
    key: "operations",
    label: "Operations",
    items: [
      { key: "fees", label: "Fees", href: "/fees", icon: Wallet },
      { key: "accounting", label: "Accounting", href: "/accounting", icon: Calculator },
      { key: "payroll", label: "Payroll", href: "/payroll", icon: HandCoins },
      { key: "transport", label: "Transport", href: "/transport", icon: Bus },
      { key: "library", label: "Library", href: "/library", icon: Library },
      { key: "inventory", label: "Inventory", href: "/inventory", icon: Boxes },
      { key: "assets", label: "Assets", href: "/assets", icon: Boxes },
      { key: "hr", label: "HR", href: "/hr", icon: IdCard },
    ],
  },
  {
    key: "campus-life",
    label: "Student Life",
    items: [
      { key: "student-life", label: "Campus Services", href: "/campus-life", icon: LayoutDashboard },
      { key: "hostel", label: "Hostel", href: "/hostel", icon: Hotel },
      { key: "health", label: "Health", href: "/health", icon: HeartPulse },
      { key: "counselling", label: "Counselling", href: "/counselling", icon: HandHeart },
      { key: "cafeteria", label: "Cafeteria", href: "/cafeteria", icon: UtensilsCrossed },
    ],
  },
  {
    key: "activities",
    label: "Activities",
    items: [
      { key: "activities-home", label: "Activities", href: "/activities", icon: Sparkles },
      { key: "events", label: "Events", href: "/activities/events", icon: PartyPopper },
      { key: "events-calendar", label: "Event Calendar", href: "/activities/events/calendar", icon: Calendar },
      { key: "clubs", label: "Clubs", href: "/activities/clubs", icon: Users2 },
      { key: "sports", label: "Sports", href: "/activities/sports", icon: Volleyball },
      { key: "competitions", label: "Competitions", href: "/activities/competitions", icon: Medal },
      { key: "houses", label: "House System", href: "/activities/houses", icon: Shield },
      { key: "leaderboard", label: "House Leaderboard", href: "/activities/houses/leaderboard", icon: Trophy },
      { key: "achievements", label: "Achievements", href: "/activities/achievements", icon: Award },
      { key: "awards", label: "Awards", href: "/activities/awards", icon: Trophy },
      { key: "activity-certificates", label: "Certificates", href: "/activities/certificates", icon: FileBadge },
      { key: "activities-analytics", label: "Analytics", href: "/activities/analytics", icon: BarChart3 },
    ],
  },
  {
    key: "document-studio",
    label: "Document Studio",
    items: [
      { key: "documents", label: "Document Studio", href: "/documents", icon: Files },
      { key: "doc-templates", label: "Templates", href: "/documents/templates", icon: LayoutTemplate },
      { key: "doc-generate", label: "Generate", href: "/documents/generate", icon: Sparkles },
      { key: "doc-batch", label: "Batch", href: "/documents/batch", icon: FileStack },
      { key: "id-cards", label: "ID Cards", href: "/id-cards", icon: IdCard },
      { key: "doc-certificates", label: "Certificates", href: "/certificates", icon: FileBadge },
      { key: "letters", label: "Letters", href: "/letters", icon: ScrollText },
      { key: "admit-cards", label: "Admit Cards", href: "/admit-cards", icon: FileSignature },
      { key: "print-queue", label: "Print Centre", href: "/documents/print-queue", icon: Printer },
      { key: "doc-verification", label: "Verification", href: "/documents/verification", icon: QrCode },
      { key: "doc-history", label: "History", href: "/documents/history", icon: Files },
    ],
  },
  {
    key: "more",
    label: "More",
    items: [
      { key: "communication", label: "Communication", href: "/communication", icon: MessageSquare },
      { key: "helpdesk", label: "Helpdesk", href: "/helpdesk", icon: LifeBuoy },
      { key: "front-desk", label: "Front Desk", href: "/front-desk", icon: DoorOpen },
      { key: "reports", label: "Reports", href: "/reports", icon: BarChart3 },
      { key: "integrations", label: "Integrations", href: "/integrations", icon: Plug },
      { key: "settings", label: "Settings", href: "/settings", icon: Settings },
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
  { key: "people", label: "People", href: "/students", icon: Users },
  { key: "academics", label: "Academics", href: "/academics", icon: Presentation },
];

export const createActions = [
  { key: "student", label: "Add student", icon: GraduationCap },
  { key: "teacher", label: "Add teacher", icon: Presentation },
  { key: "payment", label: "Record payment", icon: Wallet },
  { key: "announcement", label: "Create announcement", icon: Megaphone },
  { key: "homework", label: "Create homework", icon: FileText },
  { key: "exam", label: "Schedule exam", icon: FileBadge },
  { key: "event", label: "Add event", icon: CalendarPlus },
  { key: "certificate", label: "Create certificate", icon: BadgeCheck },
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
