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
  IdCard,
  Inbox,
  LayoutDashboard,
  Library,
  LifeBuoy,
  Megaphone,
  MessageSquare,
  NotebookPen,
  Plug,
  Presentation,
  Settings,
  UserPlus,
  Users,
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
    key: "more",
    label: "More",
    items: [
      { key: "communication", label: "Communication", href: "/communication", icon: MessageSquare },
      { key: "helpdesk", label: "Helpdesk", href: "/helpdesk", icon: LifeBuoy },
      { key: "front-desk", label: "Front Desk", href: "/front-desk", icon: DoorOpen },
      { key: "certificates", label: "Certificates", href: "/certificates", icon: FileBadge },
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
