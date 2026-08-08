// ---------------------------------------------------------------------------
// Development demo accounts — these map 1:1 to REAL seeded database users
// (prisma/seed.ts). The demo-access panel signs in through the normal Better
// Auth credential flow using the server-side dev password; it never fabricates
// a session. Rendered only in non-production builds. If you change the seed
// users, change this list too.
// ---------------------------------------------------------------------------

export type DemoRole = "platform" | "admin" | "leadership" | "staff";

export type SeededDemoAccount = {
  email: string;
  name: string;
  label: string;
  color: string;
  group: DemoRole;
};

export const SEEDED_DEMO_ACCOUNTS: SeededDemoAccount[] = [
  { email: "aditya@novyra.io", name: "Aditya Rao", label: "Platform Super Admin", color: "#022c43", group: "platform" },
  { email: "kavya@novyra.edu.in", name: "Kavya Iyer", label: "School Administrator", color: "#0891b2", group: "admin" },
  { email: "meera@novyra.edu.in", name: "Dr. Meera Krishnan", label: "Principal", color: "#7c3aed", group: "leadership" },
  { email: "ananya@novyra.edu.in", name: "Ananya Sharma", label: "Teacher", color: "#16a34a", group: "staff" },
  { email: "rahul@novyra.edu.in", name: "Rahul Verma", label: "Accountant", color: "#0284c7", group: "staff" },
  { email: "priya@novyra.edu.in", name: "Priya Nair", label: "Librarian", color: "#0ea5e9", group: "staff" },
  { email: "auditor@novyra.edu.in", name: "Ishaan Bose", label: "Auditor", color: "#475569", group: "admin" },
];
