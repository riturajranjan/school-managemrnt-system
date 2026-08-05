import { AlertTriangle, Bus, CalendarClock, ClipboardList, Mail, Phone } from "lucide-react";
import { StatTile } from "@/components/ui/stat-tile";
import { Badge } from "@/components/ui/badge";
import { StudentGrowthOrbit } from "@/components/students/growth-orbit/growth-orbit";
import { useStudentGuardians } from "@/lib/hooks/use-students";
import type { Student } from "@/lib/types/students";
import { feeStatusTone } from "@/components/students/student-meta";
import { formatCurrency, formatDate } from "@/lib/utils";

export function OverviewTab({ student }: { student: Student }) {
  const guardians = useStudentGuardians(student.id);
  const primary = guardians.find((g) => g.link.isPrimary) ?? guardians[0];
  const alerts: string[] = [];
  if (student.attendance.presentPercent < 75) alerts.push("Attendance below 75% — may affect exam eligibility.");
  if (student.fees.status === "overdue") alerts.push(`Fee overdue: ${formatCurrency(student.fees.overdueAmount)}.`);
  if (student.documents.some((d) => d.status === "missing")) alerts.push("One or more required documents are missing.");
  if (student.academics.subjectsAtRisk.length > 0) alerts.push(`At risk in ${student.academics.subjectsAtRisk.join(", ")}.`);

  return (
    <div className="flex flex-col gap-md">
      <div className="grid grid-cols-1 gap-md lg:grid-cols-[280px_1fr]">
        <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-surface p-md">
          <h3 className="mb-sm self-start text-sm font-semibold text-foreground">Student Growth Orbit</h3>
          <StudentGrowthOrbit pulse={student.pulse} />
          <p className="mt-sm text-center text-xs text-muted-foreground">{student.pulse.explanation}</p>
        </div>

        <div className="flex flex-col gap-md">
          <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
            <StatTile label="Today" value={student.attendance.todayStatus.replace("-", " ")} icon={ClipboardList} tone={student.attendance.todayStatus === "present" ? "success" : "warning"} />
            <StatTile label="Attendance" value={`${student.attendance.presentPercent}%`} icon={CalendarClock} tone={student.attendance.presentPercent < 75 ? "error" : "success"} />
            <StatTile label="Academics" value={`${student.academics.overallPercent}%`} icon={ClipboardList} tone="info" />
            <StatTile label="Fees" value={student.fees.status} icon={ClipboardList} tone={feeStatusTone[student.fees.status]} />
          </div>

          {alerts.length > 0 && (
            <div className="flex flex-col gap-1 rounded-lg border border-warning/30 bg-warning/10 p-sm text-xs text-warning">
              <span className="flex items-center gap-1 font-medium">
                <AlertTriangle className="size-3.5" /> Alerts & interventions
              </span>
              {alerts.map((a) => (
                <span key={a}>· {a}</span>
              ))}
            </div>
          )}

          <div className="rounded-lg border border-border p-sm">
            <h3 className="mb-xs text-sm font-semibold text-foreground">Parent contact</h3>
            {primary ? (
              <div className="flex flex-col gap-1 text-sm">
                <span className="text-foreground">
                  {primary.firstName} {primary.lastName} ({primary.link.relationship})
                </span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Phone className="size-3" /> {primary.contact.phone}
                </span>
                {primary.contact.email && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Mail className="size-3" /> {primary.contact.email}
                  </span>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No guardian on file.</p>
            )}
          </div>

          {student.transport && (
            <div className="flex items-center gap-sm rounded-lg border border-border p-sm text-sm">
              <Bus className="size-4 text-info" aria-hidden="true" />
              <span className="text-foreground">{student.transport.routeName}</span>
              <span className="text-xs text-muted-foreground">{student.transport.stopName}</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
        <div className="rounded-lg border border-border p-sm">
          <h3 className="mb-xs text-sm font-semibold text-foreground">Upcoming exams</h3>
          {student.academics.upcomingExams.length === 0 ? (
            <p className="text-sm text-muted-foreground">No exams scheduled.</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {student.academics.upcomingExams.map((exam) => (
                <li key={exam.id} className="flex justify-between text-foreground">
                  <span>{exam.subject}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(exam.date)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-lg border border-border p-sm">
          <h3 className="mb-xs text-sm font-semibold text-foreground">Recent homework</h3>
          {student.academics.recentHomework.length === 0 ? (
            <p className="text-sm text-muted-foreground">No homework recorded.</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {student.academics.recentHomework.map((hw) => (
                <li key={hw.id} className="flex items-center justify-between text-foreground">
                  <span>
                    {hw.subject}: {hw.title}
                  </span>
                  <Badge tone={hw.status === "submitted" ? "success" : hw.status === "late" ? "error" : "warning"}>{hw.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {student.timeline.length > 0 && (
        <div className="rounded-lg border border-border p-sm">
          <h3 className="mb-xs text-sm font-semibold text-foreground">Recent activity</h3>
          <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
            {student.timeline.slice(0, 4).map((event) => (
              <li key={event.id} className="flex justify-between">
                <span className="text-foreground">{event.title}</span>
                <span className="text-xs">{formatDate(event.createdAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
