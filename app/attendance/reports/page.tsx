"use client";

// Attendance reports (Phase 5B) — same visual design as before (report-type
// selector, export/print, generic results table) now fully PostgreSQL/API-backed
// via /api/attendance/reports. Every row + percentage is computed server-side
// with the canonical Phase 5 summary formula; there is no mock store, no
// localStorage, no client-side aggregation. Student reports (daily/trend/class/
// shortage/late-arrival/consecutive-absence) are real. The "Staff attendance
// report" tab depends on the Staff Attendance module (not migrated) and shows an
// honest unavailable state rather than mock data.
import Papa from "papaparse";
import { useState } from "react";
import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAttendanceReport } from "@/lib/hooks/api/use-attendance";
import type { AttendanceReportType } from "@/lib/api/contracts";

type ReportTab = AttendanceReportType | "staff";

const reportLabels: Record<ReportTab, string> = {
  daily: "Daily report",
  "monthly-trend": "Monthly trend",
  class: "Class report",
  shortage: "Shortage report",
  "late-arrival": "Late-arrival report",
  "consecutive-absence": "Consecutive-absence report",
  staff: "Staff attendance report",
};

export default function AttendanceReportsPage() {
  const [reportTab, setReportTab] = useState<ReportTab>("daily");
  const apiType: AttendanceReportType | null = reportTab === "staff" ? null : reportTab;
  const { data: report, loading, error } = useAttendanceReport(apiType);

  const columns = report?.columns ?? [];
  const rows = report?.rows ?? [];

  function exportCsv() {
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${reportTab}-attendance-report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-md">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Attendance reports</h1>
          <p className="text-xs text-muted-foreground">{reportLabels[reportTab]}</p>
        </div>
        <div className="flex flex-wrap items-center gap-xs">
          <Select value={reportTab} onValueChange={(v) => setReportTab(v as ReportTab)}>
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
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
            <Download className="size-3.5" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="size-3.5" />
            Print
          </Button>
        </div>
      </div>

      {reportTab === "staff" ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">
          Staff attendance reporting depends on the Staff Attendance module, which isn&apos;t available yet.
        </p>
      ) : error ? (
        <p className="rounded-lg border border-error/30 bg-error/10 p-md text-center text-sm text-error">{error}</p>
      ) : loading ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Loading report…</p>
      ) : rows.length === 0 ? (
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
                      {String(row[c])}
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
