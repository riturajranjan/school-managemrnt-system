import type { UserRole } from "@/lib/permissions/roles";

// ===========================================================================
// Phase 14.5 — Authentication & Access experience. FRONTEND MOCK ONLY.
// No real authentication, sessions, OTP delivery, email verification, SSO,
// 2FA or persistence. These types describe simulated demo state used purely to
// make the auth screens behave realistically.
// ===========================================================================

export type MockRoleAccess = {
  role: UserRole;
  label: string;
  schoolId: string;
  branchId?: string;
};

export type MockSchoolAccess = {
  id: string;
  name: string;
  code: string;
  city: string;
  board: string;
  branchCount: number;
  status: "active" | "inactive";
  logoColor: string;
  lastAccessed?: string;
  favorite?: boolean;
};

export type MockAuthUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatarColor: string;
  roles: MockRoleAccess[];
  children?: MockChild[];
};

export type MockChild = {
  id: string;
  name: string;
  className: string;
  section: string;
  schoolName: string;
  avatarColor: string;
  attendanceToday: "present" | "absent" | "not-marked";
};

export type MockAuthSession = { userId: string; role: UserRole; schoolId: string; startedAt: string };

export type MockLoginAttempt = { at: string; device: string; location: string; result: "success" | "failed" };

export type MockInvitation = {
  id: string;
  schoolName: string;
  invitedBy: string;
  role: string;
  branch: string;
  email: string;
  expiresAt: string;
};

export type MockTrustedDevice = {
  id: string;
  device: string;
  browser: string;
  location: string;
  lastActive: string;
  current: boolean;
  trusted: boolean;
};

export type MockSecurityPreference = { key: string; label: string; description: string; enabled: boolean; backendRequired: boolean };

export type MockAcademicSessionOption = { id: string; name: string; state: "current" | "previous" | "upcoming" };

// ---------------------------------------------------------------------------
// Where each role lands after a simulated login.
// ---------------------------------------------------------------------------

export const roleRedirect: Partial<Record<UserRole, string>> = {
  "super-admin": "/super-admin",
  "school-owner": "/",
  principal: "/",
  administrator: "/",
  "examination-controller": "/exams",
  "academic-coordinator": "/academics",
  teacher: "/teacher/my-day",
  student: "/student/activities",
  parent: "/parent/activities",
  librarian: "/library",
  "transport-administrator": "/transport",
  "transport-manager": "/transport",
  "hr-manager": "/hr",
  "hr-executive": "/hr",
  accountant: "/fees",
  cashier: "/fees",
  "cafeteria-manager": "/cafeteria",
  "hostel-warden": "/hostel",
  nurse: "/health",
  counsellor: "/counselling",
  receptionist: "/front-desk",
  "communication-admin": "/communication",
  "activities-coordinator": "/activities",
  auditor: "/",
};

export function redirectForRole(role: UserRole): string { return roleRedirect[role] ?? "/"; }

// ---------------------------------------------------------------------------
// Demo data (development/demo mode only).
// ---------------------------------------------------------------------------

// NOTE: The authenticated workspace-context selectors (school/role/branch/
// session) are now backed by real APIs (Backend Phase 2 Batch 4); their mock
// arrays (formerly MOCK_BRANCHES / MOCK_SESSIONS) were removed. MOCK_SCHOOLS
// remains only for the pre-login /login/school browse screen (still a mock UX).
export const MOCK_SCHOOLS: MockSchoolAccess[] = [
  { id: "sch-nvx", name: "Novyra Public School", code: "NVX-001", city: "Gurugram", board: "CBSE", branchCount: 3, status: "active", logoColor: "#18b0c8", lastAccessed: "2 hours ago", favorite: true },
  { id: "sch-green", name: "Greenwood International", code: "GWI-204", city: "Bengaluru", board: "CBSE", branchCount: 2, status: "active", logoColor: "#16a34a", lastAccessed: "Yesterday" },
  { id: "sch-heritage", name: "Heritage Valley School", code: "HVS-118", city: "Pune", board: "ICSE", branchCount: 1, status: "inactive", logoColor: "#7c3aed" },
];

export type DemoAccount = { key: string; name: string; role: UserRole; label: string; email: string; avatarColor: string; multiRole?: MockRoleAccess[]; children?: MockChild[] };

export const DEMO_ACCOUNTS: DemoAccount[] = [
  { key: "super", name: "Aditya Rao", role: "super-admin", label: "Platform Super Admin", email: "aditya@novyra.io", avatarColor: "#022c43" },
  { key: "admin", name: "Kavya Iyer", role: "administrator", label: "School Administrator", email: "kavya@novyra.edu.in", avatarColor: "#0891b2" },
  { key: "principal", name: "Dr. Meera Krishnan", role: "principal", label: "Principal", email: "meera@novyra.edu.in", avatarColor: "#7c3aed" },
  {
    key: "teacher", name: "Ananya Sharma", role: "teacher", label: "Teacher", email: "ananya@novyra.edu.in", avatarColor: "#16a34a",
    multiRole: [{ role: "teacher", label: "Teacher", schoolId: "sch-nvx" }, { role: "academic-coordinator", label: "Academic Coordinator", schoolId: "sch-nvx" }],
  },
  { key: "student", name: "Aarav Gupta", role: "student", label: "Student", email: "aarav@student.novyra.edu.in", avatarColor: "#f59e0b" },
  {
    key: "parent", name: "Suresh Gupta", role: "parent", label: "Parent", email: "suresh.gupta@gmail.com", avatarColor: "#c2410c",
    children: [
      { id: "ch-1", name: "Aarav Gupta", className: "Class 5", section: "A", schoolName: "Novyra Public School", avatarColor: "#f59e0b", attendanceToday: "present" },
      { id: "ch-2", name: "Diya Gupta", className: "Class 2", section: "B", schoolName: "Novyra Public School", avatarColor: "#ec4899", attendanceToday: "not-marked" },
    ],
  },
  { key: "librarian", name: "Priya Nair", role: "librarian", label: "Librarian", email: "priya@novyra.edu.in", avatarColor: "#0ea5e9" },
  { key: "transport", name: "Arjun Pillai", role: "transport-manager", label: "Transport Manager", email: "arjun@novyra.edu.in", avatarColor: "#475569" },
  { key: "hr", name: "Sanjay Rao", role: "hr-manager", label: "HR Manager", email: "sanjay@novyra.edu.in", avatarColor: "#9333ea" },
];

export const MOCK_TRUSTED_DEVICES: MockTrustedDevice[] = [
  { id: "d1", device: "MacBook Pro", browser: "Chrome 128", location: "Patna, India", lastActive: "Active now", current: true, trusted: true },
  { id: "d2", device: "iPhone 15", browser: "Safari", location: "Patna, India", lastActive: "3 hours ago", current: false, trusted: true },
  { id: "d3", device: "Windows PC", browser: "Edge", location: "Delhi, India", lastActive: "2 days ago", current: false, trusted: false },
];

export const MOCK_LOGIN_HISTORY: MockLoginAttempt[] = [
  { at: "Today, 09:12", device: "MacBook Pro · Chrome", location: "Patna, India", result: "success" },
  { at: "Yesterday, 18:44", device: "iPhone 15 · Safari", location: "Patna, India", result: "success" },
  { at: "2 days ago, 08:03", device: "Windows PC · Edge", location: "Delhi, India", result: "failed" },
];

export const MOCK_RECOVERY_CODES = ["4F9K-2QX7", "7HD3-8LM1", "P2WN-6RT9", "5ZBQ-1VK4", "9CJ8-3XPD", "K7MR-4NQ2", "T3YL-8WF6", "1DVX-5GH0"];

export const MOCK_SECURITY_PREFS: MockSecurityPreference[] = [
  { key: "2fa", label: "Two-step verification", description: "Require a second factor at sign-in.", enabled: false, backendRequired: true },
  { key: "login-alerts", label: "New sign-in alerts", description: "Notify me of sign-ins from new devices.", enabled: true, backendRequired: true },
  { key: "trusted-only", label: "Trusted devices only", description: "Block sign-in from unrecognised devices.", enabled: false, backendRequired: true },
];

// Password strength (frontend only).
export type PasswordStrength = "weak" | "fair" | "good" | "strong";

export function scorePassword(pw: string): { strength: PasswordStrength; checks: { label: string; ok: boolean }[]; score: number } {
  const checks = [
    { label: "At least 8 characters", ok: pw.length >= 8 },
    { label: "A lowercase letter", ok: /[a-z]/.test(pw) },
    { label: "An uppercase letter", ok: /[A-Z]/.test(pw) },
    { label: "A number", ok: /\d/.test(pw) },
    { label: "A special character", ok: /[^A-Za-z0-9]/.test(pw) },
  ];
  const score = checks.filter((c) => c.ok).length;
  const strength: PasswordStrength = score <= 1 ? "weak" : score <= 3 ? "fair" : score === 4 ? "good" : "strong";
  return { strength, checks, score };
}
