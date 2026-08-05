"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeftCircle,
  ArrowRightCircle,
  Ban,
  Calendar1,
  CheckCircle2,
  Clock,
  Mail,
  Phone,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermissions } from "@/components/providers/permissions-provider";
import { EnrollmentWizard } from "@/components/admissions/enrollment/enrollment-wizard";
import { findClass } from "@/lib/data/seed/reference";
import { useAdmissionApplication } from "@/lib/hooks/use-admissions";
import { admissionStageDefinitions, forwardStageOrder, type AdmissionStageKey } from "@/lib/types/admissions";
import {
  approveApplication,
  moveApplicationStage,
  rejectApplication,
  waitlistApplication,
} from "@/lib/services/admissions-service";
import { formatDate, initialsOf } from "@/lib/utils";
import { stageTone } from "@/components/admissions/stage-meta";
import { OverviewTab } from "./overview-tab";
import { ApplicationTab } from "./application-tab";
import { DocumentsTab } from "./documents-tab";
import { InterviewTab } from "./interview-tab";
import { CommunicationTab } from "./communication-tab";
import { PaymentsTab } from "./payments-tab";
import { NotesTab } from "./notes-tab";
import { TimelineList } from "@/components/timeline/timeline-list";
import { addApplicationNote } from "@/lib/services/admissions-service";

export function ApplicantWorkspace({ applicationId }: { applicationId: string }) {
  const application = useAdmissionApplication(applicationId);
  const { can } = usePermissions();
  const [confirmAction, setConfirmAction] = useState<"reject" | "waitlist" | null>(null);
  const [enrollOpen, setEnrollOpen] = useState(false);

  if (!application) {
    return (
      <div className="flex flex-col items-center gap-sm py-2xl text-center">
        <p className="text-sm font-medium text-foreground">Application not found</p>
        <Button asChild variant="outline">
          <Link href="/admissions">Back to Admissions</Link>
        </Button>
      </div>
    );
  }

  const name = `${application.student.firstName} ${application.student.lastName}`;
  const primaryGuardian = application.guardians.find((g) => g.isPrimary) ?? application.guardians[0];
  const currentForwardIndex = forwardStageOrder.indexOf(application.stage);
  const nextStage = currentForwardIndex >= 0 ? forwardStageOrder[currentForwardIndex + 1] : undefined;
  const prevStage = currentForwardIndex > 0 ? forwardStageOrder[currentForwardIndex - 1] : undefined;
  const canConvert = (application.stage === "approved" || application.stage === "fee-pending") && !application.convertedStudentId;
  const canEdit = can("admissions.edit");
  const canApprove = can("admissions.approve");

  if (application.draft) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface py-2xl text-center">
        <Sparkles className="size-6 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm font-medium text-foreground">This application is still a draft</p>
        <p className="text-xs text-muted-foreground">{name || "This applicant"} hasn&apos;t submitted the application form yet.</p>
        <Button asChild>
          <Link href={`/admissions/new?draft=${application.id}`}>Continue application</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-sm sm:flex-row sm:items-start sm:justify-between sm:p-md">
        <div className="flex items-start gap-sm">
          <Avatar className="size-12">
            <AvatarFallback className="text-sm">{initialsOf(application.student.firstName, application.student.lastName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-xs">
              <h1 className="text-base font-semibold text-foreground">{name}</h1>
              <Badge tone={stageTone[application.stage]}>{admissionStageDefinitions.find((s) => s.key === application.stage)?.label}</Badge>
              {application.priority === "high" && <Badge tone="error">High priority</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">
              {application.applicationNumber} · {findClass(application.appliedClassId)?.name} · Officer: {application.assignedOfficerName ?? "Unassigned"}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-sm gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Calendar1 className="size-3" aria-hidden="true" />
                Submitted {application.submittedAt ? formatDate(application.submittedAt) : "—"}
              </span>
              {primaryGuardian && (
                <>
                  <span className="inline-flex items-center gap-1">
                    <Phone className="size-3" aria-hidden="true" />
                    {primaryGuardian.contact.phone}
                  </span>
                  {primaryGuardian.contact.email && (
                    <span className="inline-flex items-center gap-1">
                      <Mail className="size-3" aria-hidden="true" />
                      {primaryGuardian.contact.email}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-xs">
          {canConvert && canEdit && (
            <Button size="sm" onClick={() => setEnrollOpen(true)}>
              <UserCheck className="size-3.5" />
              Convert to student
            </Button>
          )}
          {canApprove && application.stage !== "approved" && application.stage !== "enrolled" && application.stage !== "rejected" && (
            <Button size="sm" variant="outline" onClick={() => approveApplication(application.id, "Principal")}>
              <CheckCircle2 className="size-3.5" />
              Approve
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">
                Stage actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Move stage</DropdownMenuLabel>
              {nextStage && canEdit && (
                <DropdownMenuItem onSelect={() => moveApplicationStage(application.id, nextStage as AdmissionStageKey, "Admission Officer")}>
                  <ArrowRightCircle className="size-3.5" />
                  Advance to {admissionStageDefinitions.find((s) => s.key === nextStage)?.label}
                </DropdownMenuItem>
              )}
              {prevStage && canEdit && (
                <DropdownMenuItem onSelect={() => moveApplicationStage(application.id, prevStage as AdmissionStageKey, "Admission Officer")}>
                  <ArrowLeftCircle className="size-3.5" />
                  Return to {admissionStageDefinitions.find((s) => s.key === prevStage)?.label}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {canApprove && (
                <DropdownMenuItem onSelect={() => setConfirmAction("waitlist")}>
                  <Clock className="size-3.5" />
                  Waitlist
                </DropdownMenuItem>
              )}
              {canApprove && (
                <DropdownMenuItem onSelect={() => setConfirmAction("reject")} className="text-error">
                  <Ban className="size-3.5" />
                  Reject
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="application">Application</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="interview">Interview</TabsTrigger>
          <TabsTrigger value="communication">Communication</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="timeline">Activity</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-md">
          <OverviewTab application={application} />
        </TabsContent>
        <TabsContent value="application" className="mt-md">
          <ApplicationTab application={application} />
        </TabsContent>
        <TabsContent value="documents" className="mt-md">
          <DocumentsTab application={application} />
        </TabsContent>
        <TabsContent value="interview" className="mt-md">
          <InterviewTab application={application} />
        </TabsContent>
        <TabsContent value="communication" className="mt-md">
          <CommunicationTab application={application} />
        </TabsContent>
        <TabsContent value="payments" className="mt-md">
          <PaymentsTab application={application} />
        </TabsContent>
        <TabsContent value="timeline" className="mt-md">
          <TimelineList events={application.timeline} onAddNote={(body) => addApplicationNote(application.id, body, "Staff", "Note")} />
        </TabsContent>
        <TabsContent value="notes" className="mt-md">
          <NotesTab application={application} />
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={confirmAction === "reject"}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title="Reject this application?"
        description="This moves the applicant out of the active pipeline. You can move it back to any stage later if needed."
        confirmLabel="Reject"
        destructive
        onConfirm={() => rejectApplication(application.id, "Does not meet admission criteria", "Principal")}
      />
      <ConfirmDialog
        open={confirmAction === "waitlist"}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title="Move to waitlist?"
        description="The applicant will be held pending seat availability."
        confirmLabel="Waitlist"
        onConfirm={() => waitlistApplication(application.id, "Admission Officer")}
      />

      {enrollOpen && <EnrollmentWizard application={application} onClose={() => setEnrollOpen(false)} />}
    </div>
  );
}
