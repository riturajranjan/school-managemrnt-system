import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/ui/stat-tile";
import { findClass } from "@/lib/data/seed/reference";
import type { AdmissionApplication } from "@/lib/types/admissions";
import { documentCompletionPercent } from "@/components/documents/document-list";
import { CalendarClock, FileCheck2, UserCheck2, Wallet } from "lucide-react";
import { formatDate } from "@/lib/utils";

export function OverviewTab({ application }: { application: AdmissionApplication }) {
  const completion = documentCompletionPercent(application.documents);
  const guardian = application.guardians.find((g) => g.isPrimary) ?? application.guardians[0];

  return (
    <div className="flex flex-col gap-md">
      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Documents" value={`${completion}%`} icon={FileCheck2} tone={completion === 100 ? "success" : "warning"} />
        <StatTile
          label="Interview"
          value={application.interview ? formatDate(application.interview.scheduledAt) : "Not scheduled"}
          icon={CalendarClock}
          tone={application.interview ? "info" : "neutral"}
        />
        <StatTile label="Fee status" value={application.feeDetails.applicationFeePaid ? "Paid" : "Pending"} icon={Wallet} tone={application.feeDetails.applicationFeePaid ? "success" : "warning"} />
        <StatTile label="Assigned officer" value={application.assignedOfficerName ?? "Unassigned"} icon={UserCheck2} tone="neutral" />
      </div>

      <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
        <div className="rounded-lg border border-border p-sm">
          <h3 className="mb-xs text-sm font-semibold text-foreground">Student</h3>
          <dl className="grid grid-cols-2 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Class applied</dt>
            <dd className="text-foreground">{findClass(application.appliedClassId)?.name}</dd>
            <dt className="text-muted-foreground">Date of birth</dt>
            <dd className="text-foreground">{application.student.dob ? formatDate(application.student.dob) : "—"}</dd>
            <dt className="text-muted-foreground">Gender</dt>
            <dd className="text-foreground capitalize">{application.student.gender.replace(/-/g, " ")}</dd>
            <dt className="text-muted-foreground">Admission type</dt>
            <dd className="text-foreground capitalize">{application.admissionType.replace(/-/g, " ")}</dd>
          </dl>
        </div>
        <div className="rounded-lg border border-border p-sm">
          <h3 className="mb-xs text-sm font-semibold text-foreground">Primary contact</h3>
          {guardian ? (
            <dl className="grid grid-cols-2 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Name</dt>
              <dd className="text-foreground">
                {guardian.firstName} {guardian.lastName}
              </dd>
              <dt className="text-muted-foreground">Relationship</dt>
              <dd className="text-foreground capitalize">{guardian.role}</dd>
              <dt className="text-muted-foreground">Phone</dt>
              <dd className="text-foreground">{guardian.contact.phone}</dd>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="text-foreground">{guardian.contact.email ?? "—"}</dd>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">No guardian on file.</p>
          )}
        </div>
      </div>

      {application.notes.length > 0 && (
        <div className="rounded-lg border border-border p-sm">
          <h3 className="mb-xs text-sm font-semibold text-foreground">Latest note</h3>
          <p className="text-sm text-muted-foreground">{application.notes[0].body}</p>
          <Badge tone="neutral" className="mt-xs">
            {application.notes[0].authorName}
          </Badge>
        </div>
      )}
    </div>
  );
}
