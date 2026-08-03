import type { LucideIcon } from "lucide-react";
import { AlertCircle, BookOpen, Bus, CalendarCheck, MessageSquare, Settings, Wallet } from "lucide-react";

export type NotificationCategoryKey =
  | "action"
  | "attendance"
  | "fees"
  | "academics"
  | "transport"
  | "communication"
  | "system";

export type NotificationCategory = { key: NotificationCategoryKey; label: string; icon: LucideIcon };

export const notificationCategories: NotificationCategory[] = [
  { key: "action", label: "Action required", icon: AlertCircle },
  { key: "attendance", label: "Attendance", icon: CalendarCheck },
  { key: "fees", label: "Fees", icon: Wallet },
  { key: "academics", label: "Academics", icon: BookOpen },
  { key: "transport", label: "Transport", icon: Bus },
  { key: "communication", label: "Communication", icon: MessageSquare },
  { key: "system", label: "System", icon: Settings },
];

export type NotificationItem = {
  id: string;
  category: NotificationCategoryKey;
  title: string;
  description: string;
  time: string;
  read: boolean;
};

// Illustrative mock notifications — no backend to source real ones from yet.
export const initialNotifications: NotificationItem[] = [
  {
    id: "n1",
    category: "action",
    title: "3 fee payments overdue",
    description: "Grade 6 and 7 — follow-up needed before Friday.",
    time: "2h ago",
    read: false,
  },
  {
    id: "n2",
    category: "action",
    title: "2 leave requests pending",
    description: "Staff leave approvals waiting on you.",
    time: "5h ago",
    read: false,
  },
  {
    id: "n3",
    category: "attendance",
    title: "Attendance not marked",
    description: "Class 8B homeroom for today.",
    time: "1h ago",
    read: false,
  },
  {
    id: "n4",
    category: "fees",
    title: "Fee reminder sent",
    description: "Sent to 12 parents for Term 2 dues.",
    time: "Yesterday",
    read: true,
  },
  {
    id: "n5",
    category: "academics",
    title: "Mid-term results published",
    description: "Grade 10 results are now visible to parents.",
    time: "Yesterday",
    read: true,
  },
  {
    id: "n6",
    category: "transport",
    title: "Route 4 delayed",
    description: "North Loop bus running about 15 minutes late.",
    time: "20m ago",
    read: false,
  },
  {
    id: "n7",
    category: "communication",
    title: "New message from Priya Sharma",
    description: "Question about the science fair schedule.",
    time: "3h ago",
    read: false,
  },
  {
    id: "n8",
    category: "system",
    title: "Scheduled maintenance",
    description: "This Sunday, 2–4 AM — brief downtime expected.",
    time: "1d ago",
    read: true,
  },
];
