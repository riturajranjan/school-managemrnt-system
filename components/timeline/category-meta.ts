import {
  Award,
  Bus,
  Calendar,
  FileBadge,
  FileText,
  GraduationCap,
  HeartPulse,
  MessageSquare,
  Settings,
  ShieldAlert,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { TimelineCategory } from "@/lib/types/common";

export const timelineCategoryIcon: Record<TimelineCategory, LucideIcon> = {
  admission: GraduationCap,
  academic: Award,
  attendance: Calendar,
  fees: Wallet,
  behaviour: ShieldAlert,
  documents: FileText,
  communication: MessageSquare,
  transport: Bus,
  health: HeartPulse,
  certificate: FileBadge,
  system: Settings,
};

export const timelineCategoryLabel: Record<TimelineCategory, string> = {
  admission: "Admission",
  academic: "Academic",
  attendance: "Attendance",
  fees: "Fees",
  behaviour: "Behaviour",
  documents: "Documents",
  communication: "Communication",
  transport: "Transport",
  health: "Health",
  certificate: "Certificate",
  system: "System",
};
