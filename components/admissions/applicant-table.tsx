"use client";

import { useRouter } from "next/navigation";
import { CheckCircle2, Download, Trash2, UserCheck } from "lucide-react";
import type { ColumnDef, RowAction } from "@/components/data-table/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { AdmissionListItemDto } from "@/lib/api/contracts";
import { admissionSourceLabels, type AdmissionSource } from "@/lib/types/admissions";
import { formatDate, initialsOf } from "@/lib/utils";
import { stageTone } from "./stage-meta";
import type { AdmissionStageKey } from "@/lib/types/admissions";

// Real-data admission columns. Guardian / document / interview columns were
// dropped — that detail is not part of the list DTO and (interview) is future.

export function buildApplicantColumns(): ColumnDef<AdmissionListItemDto>[] {
  return [
    {
      id: "applicant",
      header: "Applicant",
      alwaysVisible: true,
      sortValue: (app) => app.applicantName,
      cell: (app) => (
        <div className="flex items-center gap-sm">
          <Avatar className="size-8">
            <AvatarFallback>{initialsOf(app.firstName, app.lastName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{app.applicantName}</p>
            <p className="truncate text-xs text-muted-foreground">{app.applicationNumber}</p>
          </div>
        </div>
      ),
    },
    {
      id: "appliedClass",
      header: "Applied class",
      sortValue: (app) => app.appliedClass ?? "",
      cell: (app) => <span className="text-sm text-foreground">{app.appliedClass ?? "—"}</span>,
    },
    {
      id: "contact",
      header: "Contact",
      cell: (app) => <span className="text-xs text-muted-foreground">{app.phone ?? app.email ?? "—"}</span>,
    },
    {
      id: "source",
      header: "Source",
      sortValue: (app) => app.source,
      cell: (app) => <span className="text-sm text-foreground">{admissionSourceLabels[app.source as AdmissionSource] ?? app.source}</span>,
    },
    {
      id: "stage",
      header: "Current stage",
      cell: (app) => <Badge tone={stageTone[app.stage as AdmissionStageKey] ?? "neutral"}>{app.stage.replace(/-/g, " ")}</Badge>,
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
  onApprove: (app: AdmissionListItemDto) => void;
  onOpen: (app: AdmissionListItemDto) => void;
  onExport: (app: AdmissionListItemDto) => void;
  onReject: (app: AdmissionListItemDto) => void;
}): RowAction<AdmissionListItemDto>[] {
  const terminal = (app: AdmissionListItemDto) => app.stage === "enrolled" || app.stage === "rejected";
  return [
    { key: "approve", label: "Approve", icon: <CheckCircle2 className="size-3.5" />, onSelect: actions.onApprove, hidden: terminal },
    { key: "open", label: "Open", icon: <UserCheck className="size-3.5" />, onSelect: actions.onOpen },
    { key: "export", label: "Export", icon: <Download className="size-3.5" />, onSelect: actions.onExport },
    { key: "reject", label: "Reject", icon: <Trash2 className="size-3.5" />, onSelect: actions.onReject, destructive: true, hidden: terminal },
  ];
}

export function ApplicantMobileCard({
  app,
  selected,
  onToggleSelect,
  onOpen,
}: {
  app: AdmissionListItemDto;
  selected: boolean;
  onToggleSelect: () => void;
  onOpen: () => void;
}) {
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
        aria-label={`Select ${app.applicantName}`}
      />
      <Avatar className="size-10 shrink-0">
        <AvatarFallback>{initialsOf(app.firstName, app.lastName)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-xs">
          <p className="truncate text-sm font-semibold text-foreground">{app.applicantName}</p>
          <Badge tone={stageTone[app.stage as AdmissionStageKey] ?? "neutral"} className="shrink-0">
            {app.stage.replace(/-/g, " ")}
          </Badge>
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {app.applicationNumber} · {app.appliedClass ?? "—"}
        </p>
        <p className="truncate text-xs text-muted-foreground">{app.phone ?? app.email ?? "—"}</p>
      </div>
    </button>
  );
}

export function useGoToApplicant() {
  const router = useRouter();
  return (id: string) => router.push(`/admissions/${id}`);
}
