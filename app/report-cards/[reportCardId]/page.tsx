"use client";

import { useParams } from "next/navigation";
import { Printer, QrCode, ShieldCheck, UploadCloud } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useManagedClasses } from "@/lib/hooks/use-academics";
import { useExam, useReportCardTemplates } from "@/lib/hooks/use-exams";
import { useSisStore } from "@/lib/hooks/use-store";
import { subjectById } from "@/lib/data/seed/academics";
import { publishReportCard } from "@/lib/services/report-card-service";
import { reportCardStatusLabels, type ReportCardSectionKey } from "@/lib/types/report-cards";
import { formatDate } from "@/lib/utils";

const ACTOR = { name: "Examination Controller", role: "Examination Controller" };

export default function ReportCardPage() {
  const params = useParams<{ reportCardId: string }>();
  const db = useSisStore();
  const classes = useManagedClasses();
  const templates = useReportCardTemplates();
  const { can } = usePermissions();

  const reportCard = db.reportCards.find((rc) => rc.id === params.reportCardId);
  const exam = useExam(reportCard?.examId);
  const student = db.students.find((s) => s.id === reportCard?.studentId);
  const result = db.examResults.find((r) => r.examId === reportCard?.examId && r.studentId === reportCard?.studentId);
  const template = templates.find((t) => t.id === reportCard?.templateId);

  if (!reportCard || !exam || !student || !template) {
    return <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Report card not found.</p>;
  }

  const schoolClass = classes.find((c) => c.id === student.classId);
  const section = schoolClass?.sections.find((s) => s.id === student.sectionId);
  const remarks = db.teacherRemarks.filter((r) => r.examId === exam.id && r.studentId === student.id);
  const classTeacherRemark = remarks.find((r) => r.type === "class-teacher");
  const principalRemark = remarks.find((r) => r.type === "principal");

  const visibleSections = new Set([...template.sections].filter((s) => s.visible).sort((a, b) => a.order - b.order).map((s) => s.key));
  const isVisible = (key: ReportCardSectionKey) => visibleSections.has(key);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-sm print:hidden">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Report card</h1>
          <p className="text-xs text-muted-foreground">
            {student.profile.firstName} {student.profile.lastName} · {exam.name}
          </p>
        </div>
        <div className="flex items-center gap-xs">
          <Badge tone={reportCard.status === "published" ? "success" : reportCard.status === "revoked" ? "error" : "neutral"}>{reportCardStatusLabels[reportCard.status]}</Badge>
          {can("reportCards.publish") && reportCard.status === "generated" && (
            <Button size="sm" variant="outline" onClick={() => publishReportCard(reportCard.id, ACTOR)}>
              <UploadCloud className="size-3.5" />
              Publish
            </Button>
          )}
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="size-3.5" />
            Print / Save as PDF
          </Button>
        </div>
      </div>

      {/* The document itself — deliberately a fixed white page surface even in dark theme, matching how the printed/PDF output will actually look. */}
      <div className={`mx-auto w-full max-w-[210mm] rounded-lg border border-border bg-white p-lg text-[#111827] shadow-card print:max-w-none print:rounded-none print:border-0 print:shadow-none ${template.orientation === "landscape" ? "print:[size:landscape]" : ""}`}>
        {isVisible("header") && (
          <div className="mb-md flex items-center justify-between border-b border-[#e5e7eb] pb-sm">
            <div className="flex items-center gap-sm">
              {template.showLogo && <span className="flex size-12 items-center justify-center rounded-lg bg-[#022c43] text-lg font-bold text-white">N</span>}
              <div>
                <p className="text-base font-bold">Novyra Public School</p>
                <p className="text-xs text-[#6b7280]">Academic Session {exam.session}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold">{exam.name}</p>
              <p className="text-xs text-[#6b7280]">{formatDate(exam.startDate)} – {formatDate(exam.endDate)}</p>
            </div>
          </div>
        )}

        {isVisible("student-info") && (
          <div className="mb-md grid grid-cols-2 gap-sm text-sm sm:grid-cols-4">
            <div>
              <p className="text-[10px] uppercase text-[#6b7280]">Student</p>
              <p className="font-medium">{student.profile.firstName} {student.profile.lastName}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-[#6b7280]">Class</p>
              <p className="font-medium">{schoolClass?.name}-{section?.name}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-[#6b7280]">Roll no.</p>
              <p className="font-medium">{student.rollNumber ?? "—"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-[#6b7280]">Admission no.</p>
              <p className="font-medium">{student.admissionNumber}</p>
            </div>
          </div>
        )}

        {isVisible("subject-marks") && result && (
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
                {result.subjectResults.map((sr) => (
                  <tr key={sr.examSubjectId} className="border-b border-[#e5e7eb]">
                    <td className="py-1">{subjectById(sr.subjectId)?.name}</td>
                    <td className="py-1 text-right">{sr.total}</td>
                    <td className="py-1 text-right">{sr.maxMarks}</td>
                    <td className="py-1 text-right">{sr.grade}</td>
                    <td className="py-1 text-right capitalize">{sr.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {isVisible("grade-summary") && result && (
          <div className="mb-md grid grid-cols-2 gap-sm text-sm sm:grid-cols-4">
            <div>
              <p className="text-[10px] uppercase text-[#6b7280]">Total</p>
              <p className="font-medium">{result.totalObtained}/{result.totalMax}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-[#6b7280]">Percentage</p>
              <p className="font-medium">{result.percent}%</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-[#6b7280]">Overall grade</p>
              <p className="font-medium">{result.grade}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-[#6b7280]">Rank</p>
              <p className="font-medium">{result.rank ?? "—"}</p>
            </div>
          </div>
        )}

        {isVisible("attendance") && result && (
          <div className="mb-md">
            <p className="text-[10px] uppercase text-[#6b7280]">Exam attendance</p>
            <p className="text-sm font-medium">{result.attendancePercent}%</p>
          </div>
        )}

        {isVisible("co-curricular") && (
          <div className="mb-md">
            <p className="text-[10px] uppercase text-[#6b7280]">Co-curricular assessment</p>
            <p className="text-sm text-[#6b7280]">Not recorded for this exam.</p>
          </div>
        )}

        {isVisible("skills") && (
          <div className="mb-md">
            <p className="text-[10px] uppercase text-[#6b7280]">Skills</p>
            <p className="text-sm text-[#6b7280]">Not recorded for this exam.</p>
          </div>
        )}

        {isVisible("teacher-remark") && (
          <div className="mb-sm">
            <p className="text-[10px] uppercase text-[#6b7280]">Class teacher remark</p>
            <p className="text-sm">{classTeacherRemark?.text ?? "—"}</p>
          </div>
        )}

        {isVisible("principal-remark") && (
          <div className="mb-md">
            <p className="text-[10px] uppercase text-[#6b7280]">Principal remark</p>
            <p className="text-sm">{principalRemark?.text ?? "—"}</p>
          </div>
        )}

        {isVisible("promotion-status") && (
          <div className="mb-md">
            <p className="text-[10px] uppercase text-[#6b7280]">Promotion status</p>
            <p className="text-sm">{result?.status === "pass" ? "Promoted" : "Pending final decision"}</p>
          </div>
        )}

        {isVisible("signatures") && (
          <div className="mb-md mt-lg grid grid-cols-3 gap-sm text-center text-xs">
            {template.signatureLabels.map((label) => (
              <div key={label} className="border-t border-[#111827] pt-1">
                {label}
              </div>
            ))}
          </div>
        )}

        {isVisible("qr-verification") && (
          <div className="mb-md flex items-center gap-sm text-xs text-[#6b7280]">
            <span className="flex size-12 items-center justify-center rounded-md border border-dashed border-[#9ca3af]">
              <QrCode className="size-6" />
            </span>
            <span className="flex items-center gap-1">
              <ShieldCheck className="size-3.5" /> Scan to verify this report card at novyra.edu.in/verify/{reportCard.id}
            </span>
          </div>
        )}

        {isVisible("footer") && (
          <p className="mt-lg border-t border-[#e5e7eb] pt-sm text-center text-[10px] text-[#6b7280]">{template.footerNote ?? "This is a computer-generated report card."}</p>
        )}
      </div>
    </div>
  );
}
