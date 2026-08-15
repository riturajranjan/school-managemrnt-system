"use client";

// Report card — official document (Phase 8D). Real PostgreSQL/API cutover: this
// is a pure presentation of an already-published, immutable exam result
// (Phase 8C) — no marks/grade recomputation happens here. Same printable-page
// look as the previous version; sections with no real backing (Rank, GPA,
// Promotion, QR verification, exam attendance %, teacher/principal remarks) are
// shown as an honest "not available" state or removed rather than fabricated —
// see Phase 8D scope notes.
import Link from "next/link";
import { useParams } from "next/navigation";
import { Printer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useReportCard } from "@/lib/hooks/api/use-report-cards-api";
import { formatDate, formatDateTime } from "@/lib/utils";

const statusLabel: Record<string, string> = { pass: "Pass", fail: "Fail", absent: "Absent" };
const statusTone: Record<string, "success" | "error" | "warning" | "neutral"> = { pass: "success", fail: "error", absent: "neutral" };

export default function ReportCardPage() {
  const params = useParams<{ examId: string; studentId: string }>();
  const { can } = usePermissions();
  const { data: card, loading, error } = useReportCard(params.examId, params.studentId);

  if (!can("results.view")) {
    return <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">You don&apos;t have permission to view report cards.</p>;
  }
  if (loading) return <p className="py-2xl text-center text-sm text-muted-foreground">Loading…</p>;
  if (error || !card) {
    return (
      <div className="flex flex-col gap-sm">
        <Link href={`/report-cards/${params.examId}`} className="text-xs text-muted-foreground hover:underline print:hidden">← Roster</Link>
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">{error ?? "Report card not found."}</p>
      </div>
    );
  }

  const classSectionLabel = card.classContext.className ? `${card.classContext.className}${card.classContext.sectionName ? `-${card.classContext.sectionName}` : ""}` : "—";

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-sm print:hidden">
        <div>
          <Link href={`/report-cards/${params.examId}`} className="text-xs text-muted-foreground hover:underline">← Roster</Link>
          <h1 className="text-lg font-semibold text-foreground">Report card</h1>
          <p className="text-xs text-muted-foreground">{card.student.name} · {card.exam.name}</p>
        </div>
        <div className="flex items-center gap-xs">
          <Badge tone="success">Official — published {formatDateTime(card.publishedAt)}</Badge>
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="size-3.5" />
            Print
          </Button>
        </div>
      </div>

      {/* The document itself — deliberately a fixed white page surface even in dark theme, matching how the printed output will actually look. */}
      <div className="mx-auto w-full max-w-[210mm] rounded-lg border border-border bg-white p-lg text-[#111827] shadow-card print:max-w-none print:rounded-none print:border-0 print:shadow-none">
        <div className="mb-md flex items-center justify-between border-b border-[#e5e7eb] pb-sm">
          <div className="flex items-center gap-sm">
            <span className="flex size-12 items-center justify-center rounded-lg bg-[#022c43] text-lg font-bold text-white">{card.school.name.charAt(0) || "S"}</span>
            <div>
              <p className="text-base font-bold">{card.school.name || "School"}</p>
              <p className="text-xs text-[#6b7280]">{card.exam.term.name}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold">{card.exam.name}</p>
            <p className="text-xs text-[#6b7280]">{formatDate(card.exam.startsOn)} – {formatDate(card.exam.endsOn)}</p>
          </div>
        </div>

        <div className="mb-md grid grid-cols-2 gap-sm text-sm sm:grid-cols-4">
          <div>
            <p className="text-[10px] uppercase text-[#6b7280]">Student</p>
            <p className="font-medium">{card.student.name}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-[#6b7280]">Class</p>
            <p className="font-medium">{classSectionLabel}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-[#6b7280]">Roll no.</p>
            <p className="font-medium">{card.student.rollNumber ?? "—"}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-[#6b7280]">Admission no.</p>
            <p className="font-medium">{card.student.admissionNumber}</p>
          </div>
        </div>

        <div className="mb-md overflow-x-auto print:overflow-visible">
          <table className="w-full min-w-[360px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#111827]">
                <th className="py-1 text-left text-xs font-semibold">Subject</th>
                <th className="py-1 text-right text-xs font-semibold">Marks</th>
                <th className="py-1 text-right text-xs font-semibold">Max</th>
                <th className="py-1 text-right text-xs font-semibold">Grade</th>
                <th className="py-1 text-right text-xs font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {card.subjects.map((sr) => (
                <tr key={sr.examScheduleEntryId} className="border-b border-[#e5e7eb]">
                  <td className="py-1">{sr.subjectName}</td>
                  <td className="py-1 text-right">{sr.markStatus === "absent" ? "ABSENT" : sr.markStatus === "exempt" ? "EXEMPT" : sr.marksObtained}</td>
                  <td className="py-1 text-right">{sr.maxMarks}</td>
                  <td className="py-1 text-right">{sr.grade ?? "—"}</td>
                  <td className="py-1 text-right capitalize">{sr.passStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mb-md grid grid-cols-2 gap-sm text-sm sm:grid-cols-4">
          <div>
            <p className="text-[10px] uppercase text-[#6b7280]">Total</p>
            <p className="font-medium">{card.summary.totalMarksObtained}/{card.summary.totalMaxMarks}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-[#6b7280]">Percentage</p>
            <p className="font-medium">{card.summary.percentage ?? "—"}%</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-[#6b7280]">Overall grade</p>
            <p className="font-medium">{card.summary.grade ?? "—"}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-[#6b7280]">Result</p>
            <p className="font-medium"><Badge tone={statusTone[card.summary.status]}>{statusLabel[card.summary.status] ?? card.summary.status}</Badge></p>
          </div>
        </div>

        <div className="mb-md">
          <p className="text-[10px] uppercase text-[#6b7280]">Attendance</p>
          <p className="text-sm text-[#6b7280]">Not available for this exam.</p>
        </div>

        <div className="mb-md">
          <p className="text-[10px] uppercase text-[#6b7280]">Co-curricular assessment</p>
          <p className="text-sm text-[#6b7280]">Not recorded for this exam.</p>
        </div>

        <div className="mb-md">
          <p className="text-[10px] uppercase text-[#6b7280]">Skills</p>
          <p className="text-sm text-[#6b7280]">Not recorded for this exam.</p>
        </div>

        <div className="mb-sm">
          <p className="text-[10px] uppercase text-[#6b7280]">Class teacher remark</p>
          <p className="text-sm text-[#6b7280]">Not available yet.</p>
        </div>

        <div className="mb-md">
          <p className="text-[10px] uppercase text-[#6b7280]">Principal remark</p>
          <p className="text-sm text-[#6b7280]">Not available yet.</p>
        </div>

        <div className="mb-md mt-lg grid grid-cols-2 gap-sm text-center text-xs">
          <div className="border-t border-[#111827] pt-1">Class Teacher</div>
          <div className="border-t border-[#111827] pt-1">Principal</div>
        </div>

        <p className="mt-lg border-t border-[#e5e7eb] pt-sm text-center text-[10px] text-[#6b7280]">This is a computer-generated report card.</p>
      </div>
    </div>
  );
}
