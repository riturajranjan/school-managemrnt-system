"use client";

import Papa from "papaparse";
import { useMemo, useState } from "react";
import { Download, Printer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { findClass, findSection, schoolClasses } from "@/lib/data/seed/reference";
import { consecutiveAbsenceStudents, dailyTrend } from "@/lib/selectors/attendance-insights";
import { useAttendanceRules, useAttendanceSessions, useStaffAttendance } from "@/lib/hooks/use-attendance";
import { useSisStore } from "@/lib/hooks/use-store";
import { staffAttendanceStatusTone } from "@/lib/types/attendance";

type ReportType = "daily" | "monthly-trend" | "class" | "shortage" | "late-arrival" | "consecutive-absence" | "staff";

const reportLabels: Record<ReportType, string> = {
  daily: "Daily report",
  "monthly-trend": "Monthly trend",
  class: "Class report",
  shortage: "Shortage report",
  "late-arrival": "Late-arrival report",
  "consecutive-absence": "Consecutive-absence report",
  staff: "Staff attendance report",
};

export default function AttendanceReportsPage() {
  const db = useSisStore();
  const sessions = useAttendanceSessions();
  const staffAttendance = useStaffAttendance();
  const rules = useAttendanceRules();
  const [reportType, setReportType] = useState<ReportType>("daily");

  const minPercent = rules.find((r) => r.key === "minAttendancePercent")?.value ?? 75;
  const consecutiveThreshold = rules.find((r) => r.key === "consecutiveAbsenceAlert")?.value ?? 3;

  const rows = useMemo((): Record<string, string | number>[] => {
    switch (reportType) {
      case "daily": {
        const today = new Date().toISOString().slice(0, 10);
        return sessions
          .filter((s) => s.date.slice(0, 10) === today)
          .map((s) => ({
            Class: `${findClass(s.classId)?.name}-${findSection(s.sectionId)?.section.name}`,
            Present: s.records.filter((r) => r.status === "present").length,
            Absent: s.records.filter((r) => r.status === "absent").length,
            Late: s.records.filter((r) => r.status === "late").length,
            "Marked by": s.markedBy,
          }));
      }
      case "monthly-trend":
        return dailyTrend(sessions, 14).map((d) => ({ Date: d.date, "Present %": d.percent }));
      case "class": {
        const bySection = new Map<string, { present: number; total: number }>();
        for (const s of sessions) {
          const entry = bySection.get(s.sectionId) ?? { present: 0, total: 0 };
          entry.present += s.records.filter((r) => r.status === "present" || r.status === "late").length;
          entry.total += s.records.length;
          bySection.set(s.sectionId, entry);
        }
        return [...bySection.entries()].map(([sectionId, v]) => ({
          Class: `${findClass(schoolClasses.find((c) => c.sections.some((sec) => sec.id === sectionId))?.id ?? "")?.name}-${findSection(sectionId)?.section.name}`,
          "Present %": v.total === 0 ? 0 : Math.round((v.present / v.total) * 100),
        }));
      }
      case "shortage":
        return db.students
          .filter((s) => s.status === "active" && s.attendance.presentPercent < minPercent)
          .map((s) => ({
            Student: `${s.profile.firstName} ${s.profile.lastName}`,
            "Admission No.": s.admissionNumber,
            Class: `${findClass(s.classId)?.name}-${findSection(s.sectionId)?.section.name}`,
            "Attendance %": s.attendance.presentPercent,
          }));
      case "late-arrival":
        return sessions
          .flatMap((s) => s.records.filter((r) => r.status === "late").map((r) => ({ session: s, record: r })))
          .map(({ session, record }) => ({
            Student: db.students.find((s) => s.id === record.studentId)?.profile.firstName ?? record.studentId,
            Class: `${findClass(session.classId)?.name}-${findSection(session.sectionId)?.section.name}`,
            Date: session.date.slice(0, 10),
            "Late by (min)": record.lateMinutes ?? "—",
          }));
      case "consecutive-absence": {
        const risky = consecutiveAbsenceStudents(sessions, consecutiveThreshold);
        return [...risky].map((id) => {
          const student = db.students.find((s) => s.id === id);
          return { Student: student ? `${student.profile.firstName} ${student.profile.lastName}` : id, Class: student ? `${findClass(student.classId)?.name}-${findSection(student.sectionId)?.section.name}` : "—" };
        });
      }
      case "staff":
        return staffAttendance.map((a) => ({ Staff: a.staffName, Department: a.department, Status: a.status, "Check-in": a.checkIn ?? "—", "Check-out": a.checkOut ?? "—" }));
      default:
        return [];
    }
  }, [reportType, sessions, db.students, staffAttendance, minPercent, consecutiveThreshold]);

  function exportCsv() {
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${reportType}-attendance-report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <div className="flex flex-col gap-md">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Attendance reports</h1>
          <p className="text-xs text-muted-foreground">{reportLabels[reportType]}</p>
        </div>
        <div className="flex flex-wrap items-center gap-xs">
          <Select value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
            <SelectTrigger className="w-48" aria-label="Report type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(reportLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="size-3.5" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="size-3.5" />
            Print
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No data for this report yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-secondary/60 text-left text-xs text-muted-foreground">
                {columns.map((c) => (
                  <th key={c} className="px-sm py-sm">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  {columns.map((c) => (
                    <td key={c} className="px-sm py-sm text-foreground">
                      {reportType === "staff" && c === "Status" ? (
                        <Badge tone={staffAttendanceStatusTone[(row as Record<string, string>)[c] as keyof typeof staffAttendanceStatusTone]}>{String((row as Record<string, unknown>)[c])}</Badge>
                      ) : (
                        String((row as Record<string, unknown>)[c])
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
