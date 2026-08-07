"use client";

import Link from "next/link";
import {
  Award,
  BadgeCheck,
  BriefcaseBusiness,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  FileText,
  Gauge,
  GraduationCap,
  IdCard,
  LayoutDashboard,
  Megaphone,
  Network,
  ScrollText,
  ShieldCheck,
  UserPlus,
  UserRound,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { hrSummary } from "@/lib/selectors/hr-brief";
import { roleLabels } from "@/lib/permissions/roles";

const quickLinks = [
  { href: "/hr/staff", label: "Staff directory", description: "All employees with filters and preview", icon: Users },
  { href: "/hr/departments", label: "Departments", description: "Structure, heads and staffing", icon: Network },
  { href: "/hr/designations", label: "Designations", description: "Roles, levels and hierarchy", icon: BadgeCheck },
  { href: "/hr/org-chart", label: "Organization chart", description: "Reporting structure", icon: Network },
  { href: "/hr/recruitment", label: "Recruitment", description: "Jobs, candidates and interviews", icon: BriefcaseBusiness },
  { href: "/hr/onboarding", label: "Onboarding", description: "New-joiner journeys", icon: UserPlus },
  { href: "/hr/offboarding", label: "Offboarding", description: "Controlled exits and clearance", icon: UserRound },
  { href: "/hr/attendance", label: "Attendance", description: "Daily staff attendance", icon: ClipboardCheck },
  { href: "/hr/shifts", label: "Shifts", description: "Shift definitions and assignment", icon: CalendarClock },
  { href: "/hr/leave", label: "Leave", description: "Requests, balances and approvals", icon: CalendarDays },
  { href: "/hr/contracts", label: "Contracts", description: "Employment contracts and expiry", icon: FileText },
  { href: "/hr/documents", label: "Documents", description: "Staff document verification", icon: ScrollText },
  { href: "/hr/performance", label: "Performance", description: "Appraisals, goals and feedback", icon: Award },
  { href: "/hr/training", label: "Training", description: "Courses and development", icon: GraduationCap },
  { href: "/hr/employee-self-service", label: "Self service", description: "Employee ESS workspace", icon: IdCard },
  { href: "/hr/letters", label: "Letters", description: "Appointment, experience & more", icon: FileText },
  { href: "/hr/analytics", label: "Analytics", description: "Workforce insights", icon: LayoutDashboard },
  { href: "/hr/policies", label: "Policies", description: "HR policy library", icon: ShieldCheck },
  { href: "/hr/announcements", label: "Announcements", description: "Staff-wide notices", icon: Megaphone },
];

export default function HrHubPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  if (!can("hr.view") && !can("hr.viewOwn")) return <PermissionDenied action="view HR" role={roleLabels[role]} backHref="/" />;
  if (!can("hr.view")) {
    // Non-HR staff land on self-service.
    return <PermissionDenied action="view the HR workspace" role={roleLabels[role]} backHref="/hr/employee-self-service" />;
  }
  const summary = hrSummary(db);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Human Resources</h1>
          <p className="text-xs text-muted-foreground">Staff, recruitment, attendance, leave, performance and development</p>
        </div>
        <Button asChild size="sm">
          <Link href="/hr/dashboard">
            <Gauge className="size-3.5" /> HR Command Centre
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Active staff" value={String(summary.activeStaff)} icon={Users} tone="neutral" />
        <StatTile label="Present today" value={String(summary.presentToday)} icon={ClipboardCheck} tone="success" />
        <StatTile label="On leave" value={String(summary.onLeave)} icon={CalendarDays} tone={summary.onLeave > 0 ? "info" : "neutral"} />
        <StatTile label="Open positions" value={String(summary.openPositions)} icon={BriefcaseBusiness} tone={summary.openPositions > 0 ? "warning" : "success"} />
      </div>

      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2 lg:grid-cols-3">
        {quickLinks.map(({ href, label, description, icon: Icon }) => (
          <Link key={href} href={href} className="surface-3d flex items-center gap-sm rounded-lg border border-border bg-surface p-md outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:-translate-y-0.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Icon className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{label}</p>
              <p className="truncate text-xs text-muted-foreground">{description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
