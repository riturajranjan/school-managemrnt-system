"use client";

import { useRouter } from "next/navigation";
import { CheckCircle2, Download, Trash2, UserCheck } from "lucide-react";
import type { ColumnDef, RowAction } from "@/components/data-table/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { findClass } from "@/lib/data/seed/reference";
import type { AdmissionApplication } from "@/lib/types/admissions";
import { admissionSourceLabels } from "@/lib/types/admissions";
import { formatDate, initialsOf } from "@/lib/utils";
import { stageTone } from "./stage-meta";

function applicantName(app: AdmissionApplication) {
  return `${app.student.firstName} ${app.student.lastName}`;
}

function primaryGuardian(app: AdmissionApplication) {
  return app.guardians.find((g) => g.isPrimary) ?? app.guardians[0];
}

export function buildApplicantColumns(): ColumnDef<AdmissionApplication>[] {
  return [
    {
      id: "applicant",
      header: "Applicant",
      alwaysVisible: true,
      sortValue: (app) => applicantName(app),
      cell: (app) => (
        <div className="flex items-center gap-sm">
          <Avatar className="size-8">
            <AvatarFallback>{initialsOf(app.student.firstName, app.student.lastName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{applicantName(app)}</p>
            <p className="truncate text-xs text-muted-foreground">{app.applicationNumber}</p>
          </div>
        </div>
      ),
    },
    {
      id: "appliedClass",
      header: "Applied class",
      sortValue: (app) => findClass(app.appliedClassId)?.order ?? 0,
      cell: (app) => <span className="text-sm text-foreground">{findClass(app.appliedClassId)?.name ?? "—"}</span>,
    },
    {
      id: "parent",
      header: "Parent",
      cell: (app) => {
        const guardian = primaryGuardian(app);
        return <span className="text-sm text-foreground">{guardian ? `${guardian.firstName} ${guardian.lastName}` : "—"}</span>;
      },
    },
    {
      id: "contact",
      header: "Contact",
      cell: (app) => <span className="text-xs text-muted-foreground">{primaryGuardian(app)?.contact.phone ?? "—"}</span>,
    },
    {
      id: "source",
      header: "Source",
      sortValue: (app) => app.source,
      cell: (app) => <span className="text-sm text-foreground">{admissionSourceLabels[app.source]}</span>,
    },
    {
      id: "stage",
      header: "Current stage",
      cell: (app) => <Badge tone={stageTone[app.stage]}>{app.stage.replace(/-/g, " ")}</Badge>,
    },
    {
      id: "documents",
      header: "Documents",
      cell: (app) => {
        const approved = app.documents.filter((d) => d.status === "approved").length;
        const total = app.documents.length;
        return (
          <span className="text-xs text-muted-foreground">
            {total === 0 ? "—" : `${approved}/${total} approved`}
          </span>
        );
      },
    },
    {
      id: "interview",
      header: "Interview date",
      sortValue: (app) => (app.interview ? new Date(app.interview.scheduledAt).getTime() : 0),
      cell: (app) => <span className="text-xs text-muted-foreground">{app.interview ? formatDate(app.interview.scheduledAt) : "—"}</span>,
    },
    {
      id: "assigned",
      header: "Assigned staff",
      cell: (app) => <span className="text-xs text-muted-foreground">{app.assignedOfficerName ?? "Unassigned"}</span>,
      defaultVisible: false,
    },
    {
      id: "submitted",
      header: "Submission date",
      sortValue: (app) => (app.submittedAt ? new Date(app.submittedAt).getTime() : 0),
      cell: (app) => <span className="text-xs text-muted-foreground">{app.submittedAt ? formatDate(app.submittedAt) : "Not submitted"}</span>,
      defaultVisible: false,
    },
    {
      id: "status",
      header: "Status",
      align: "right",
      cell: (app) => <Badge tone={app.draft ? "neutral" : "info"}>{app.draft ? "Draft" : "Submitted"}</Badge>,
    },
  ];
}

export function buildApplicantRowActions(actions: {
  onApprove: (app: AdmissionApplication) => void;
  onAssign: (app: AdmissionApplication) => void;
  onExport: (app: AdmissionApplication) => void;
  onReject: (app: AdmissionApplication) => void;
}): RowAction<AdmissionApplication>[] {
  return [
    { key: "approve", label: "Approve", icon: <CheckCircle2 className="size-3.5" />, onSelect: actions.onApprove, hidden: (app) => app.stage === "enrolled" || app.stage === "rejected" },
    { key: "assign", label: "Assign staff", icon: <UserCheck className="size-3.5" />, onSelect: actions.onAssign },
    { key: "export", label: "Export", icon: <Download className="size-3.5" />, onSelect: actions.onExport },
    { key: "reject", label: "Reject", icon: <Trash2 className="size-3.5" />, onSelect: actions.onReject, destructive: true, hidden: (app) => app.stage === "enrolled" || app.stage === "rejected" },
  ];
}

export function ApplicantMobileCard({ app, selected, onToggleSelect, onOpen }: { app: AdmissionApplication; selected: boolean; onToggleSelect: () => void; onOpen: () => void }) {
  const guardian = primaryGuardian(app);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="surface-3d flex w-full min-h-11 items-start gap-sm rounded-lg border border-border bg-surface p-sm text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]"
    >
      <input
        type="checkbox"
        checked={selected}
        onClick={(e) => e.stopPropagation()}
        onChange={onToggleSelect}
        className="mt-1 size-4 shrink-0 accent-primary"
        aria-label={`Select ${applicantName(app)}`}
      />
      <Avatar className="size-10 shrink-0">
        <AvatarFallback>{initialsOf(app.student.firstName, app.student.lastName)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-xs">
          <p className="truncate text-sm font-semibold text-foreground">{applicantName(app)}</p>
          <Badge tone={stageTone[app.stage]} className="shrink-0">{app.stage.replace(/-/g, " ")}</Badge>
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {app.applicationNumber} · {findClass(app.appliedClassId)?.name ?? "—"}
        </p>
        <p className="truncate text-xs text-muted-foreground">{guardian ? `${guardian.firstName} ${guardian.lastName} · ${guardian.contact.phone}` : "—"}</p>
      </div>
    </button>
  );
}

export function useGoToApplicant() {
  const router = useRouter();
  return (id: string) => router.push(`/admissions/${id}`);
}
