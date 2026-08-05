import { findClass } from "@/lib/data/seed/reference";
import type { AdmissionApplication } from "@/lib/types/admissions";
import { formatDate } from "@/lib/utils";

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value || "—"}</dd>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border p-sm">
      <h3 className="mb-sm text-sm font-semibold text-foreground">{title}</h3>
      <dl className="grid grid-cols-2 gap-sm sm:grid-cols-3">{children}</dl>
    </div>
  );
}

export function ApplicationTab({ application }: { application: AdmissionApplication }) {
  return (
    <div className="flex flex-col gap-md">
      <SectionCard title="Student details">
        <Field label="Full name" value={`${application.student.firstName} ${application.student.middleName ?? ""} ${application.student.lastName}`} />
        <Field label="Preferred name" value={application.student.preferredName} />
        <Field label="Date of birth" value={application.student.dob ? formatDate(application.student.dob) : undefined} />
        <Field label="Gender" value={application.student.gender} />
        <Field label="Blood group" value={application.student.bloodGroup} />
        <Field label="Nationality" value={application.student.nationality} />
        <Field label="Religion" value={application.student.religion} />
        <Field label="Category" value={application.student.category} />
        <Field label="Mother tongue" value={application.student.motherTongue} />
        <Field label="Applied class" value={findClass(application.appliedClassId)?.name} />
        <Field label="Section preference" value={application.appliedSectionPreference} />
        <Field label="Admission type" value={application.admissionType} />
      </SectionCard>

      <SectionCard title="Guardians">
        {application.guardians.map((g) => (
          <Field key={g.id} label={`${g.role}${g.isPrimary ? " (primary)" : ""}`} value={`${g.firstName} ${g.lastName} · ${g.contact.phone}`} />
        ))}
      </SectionCard>

      <SectionCard title="Address">
        <Field label="Address" value={`${application.address.line1}, ${application.address.city}, ${application.address.state} ${application.address.postalCode}`} />
      </SectionCard>

      {application.previousSchool && (
        <SectionCard title="Previous school">
          <Field label="School" value={application.previousSchool.schoolName} />
          <Field label="Board" value={application.previousSchool.board} />
          <Field label="Last class completed" value={application.previousSchool.lastClassCompleted} />
        </SectionCard>
      )}

      {application.medicalInfo && (
        <SectionCard title="Medical information">
          <Field label="Allergies" value={application.medicalInfo.allergies} />
          <Field label="Conditions" value={application.medicalInfo.conditions} />
          <Field label="Emergency contact" value={`${application.medicalInfo.emergencyContact} · ${application.medicalInfo.emergencyPhone}`} />
        </SectionCard>
      )}

      <SectionCard title="Transport & hostel">
        <Field label="Transport required" value={application.transport.required ? "Yes" : "No"} />
        <Field label="Hostel required" value={application.hostel.required ? "Yes" : "No"} />
      </SectionCard>
    </div>
  );
}
