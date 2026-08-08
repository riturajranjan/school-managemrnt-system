import type { LucideIcon } from "lucide-react";
import { Bus, Briefcase, FileBadge, FileStack, FileText, GraduationCap, Layers, Library, Presentation, Receipt, Users } from "lucide-react";

export type SearchCategoryKey =
  | "students"
  | "parents"
  | "teachers"
  | "staff"
  | "classes"
  | "invoices"
  | "receipts"
  | "exams"
  | "documents"
  | "transport"
  | "library";

export type SearchCategory = { key: SearchCategoryKey; label: string; icon: LucideIcon };

export const searchCategories: SearchCategory[] = [
  { key: "students", label: "Students", icon: GraduationCap },
  { key: "parents", label: "Parents", icon: Users },
  { key: "teachers", label: "Teachers", icon: Presentation },
  { key: "staff", label: "Staff", icon: Briefcase },
  { key: "classes", label: "Classes", icon: Layers },
  { key: "invoices", label: "Invoices", icon: FileText },
  { key: "receipts", label: "Receipts", icon: Receipt },
  { key: "exams", label: "Exams", icon: FileBadge },
  { key: "documents", label: "Documents", icon: FileStack },
  { key: "transport", label: "Transport routes", icon: Bus },
  { key: "library", label: "Library books", icon: Library },
];

export type SearchRecord = {
  id: string;
  category: SearchCategoryKey;
  title: string;
  subtitle: string;
  href: string;
};

// Illustrative mock index — not backed by a real search API yet.
export const searchRecords: SearchRecord[] = [
  { id: "st-1", category: "students", title: "Aarav Mehta", subtitle: "Grade 8B · Roll No. 14", href: "/students" },
  { id: "st-2", category: "students", title: "Diya Kapoor", subtitle: "Grade 5A · Roll No. 22", href: "/students" },
  { id: "pa-1", category: "parents", title: "Rohan Kapoor", subtitle: "Parent of Diya Kapoor", href: "/parents" },
  { id: "pa-2", category: "parents", title: "Sunita Mehta", subtitle: "Parent of Aarav Mehta", href: "/parents" },
  { id: "te-1", category: "teachers", title: "Priya Sharma", subtitle: "Mathematics · Grade 8", href: "/teachers" },
  { id: "te-2", category: "teachers", title: "James Okoye", subtitle: "Science · Grade 5", href: "/teachers" },
  { id: "sf-1", category: "staff", title: "Anita Desai", subtitle: "Front Office", href: "/hr/staff" },
  { id: "cl-1", category: "classes", title: "Grade 8B", subtitle: "32 students · Section B", href: "/academics/classes" },
  { id: "cl-2", category: "classes", title: "Grade 5A", subtitle: "28 students · Section A", href: "/academics/classes" },
  { id: "in-1", category: "invoices", title: "Invoice #INV-2091", subtitle: "Aarav Mehta · Due 12 Aug", href: "/fees/receipts" },
  { id: "re-1", category: "receipts", title: "Receipt #RCT-1187", subtitle: "Diya Kapoor · Paid 2 Aug", href: "/fees/receipts" },
  { id: "ex-1", category: "exams", title: "Mid-Term Mathematics", subtitle: "Grade 8 · 14 Aug", href: "/exams" },
  { id: "ex-2", category: "exams", title: "Unit Test — Science", subtitle: "Grade 5 · 9 Aug", href: "/exams" },
  { id: "do-1", category: "documents", title: "Admission Policy 2026", subtitle: "PDF · Updated 3 Jul", href: "/documents" },
  { id: "tr-1", category: "transport", title: "Route 4 — North Loop", subtitle: "18 stops · Bus NC-04", href: "/transport" },
  { id: "li-1", category: "library", title: "To Kill a Mockingbird", subtitle: "Fiction · 3 copies available", href: "/library" },
];
