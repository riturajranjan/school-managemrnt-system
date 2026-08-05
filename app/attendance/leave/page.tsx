"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Plus } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef } from "@/components/data-table/types";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FieldError, Label } from "@/components/ui/label";
import { Input, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useLeaveRequests } from "@/lib/hooks/use-attendance";
import { leaveFormSchema, type LeaveFormValues } from "@/lib/schemas/academics-form";
import { approveLeave, cancelLeave, rejectLeave, submitLeaveRequest } from "@/lib/services/leave-service";
import { leaveStatusTone, leaveTypeLabels, type LeaveRequest, type LeaveType } from "@/lib/types/attendance";
import { formatDate } from "@/lib/utils";

const leaveTypeOptions: LeaveType[] = ["sick", "medical", "casual", "emergency", "family-event", "official-duty", "other"];

export default function LeavePage() {
  const requests = useLeaveRequests();
  const { can } = usePermissions();
  const [createOpen, setCreateOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<LeaveRequest | null>(null);

  const form = useForm<LeaveFormValues>({
    resolver: zodResolver(leaveFormSchema),
    defaultValues: { leaveType: "casual", halfDay: false, startDate: new Date().toISOString().slice(0, 10), endDate: new Date().toISOString().slice(0, 10) },
  });

  const columns: ColumnDef<LeaveRequest>[] = [
    {
      id: "applicant",
      header: "Applicant",
      alwaysVisible: true,
      sortValue: (r) => r.applicantName,
      cell: (r) => (
        <div>
          <p className="text-sm font-medium text-foreground">{r.applicantName}</p>
          <p className="text-xs text-muted-foreground capitalize">{r.applicantType}</p>
        </div>
      ),
    },
    { id: "type", header: "Type", cell: (r) => <span className="text-sm text-foreground">{leaveTypeLabels[r.leaveType]}</span> },
    {
      id: "dates",
      header: "Dates",
      cell: (r) => (
        <span className="text-sm text-foreground">
          {formatDate(r.startDate)} – {formatDate(r.endDate)} {r.halfDay && <span className="text-xs text-muted-foreground">(half day)</span>}
        </span>
      ),
    },
    { id: "reason", header: "Reason", cell: (r) => <span className="line-clamp-1 text-xs text-muted-foreground">{r.reason}</span>, defaultVisible: false },
    { id: "status", header: "Status", align: "right", cell: (r) => <Badge tone={leaveStatusTone[r.status]}>{r.status.replace("-", " ")}</Badge> },
  ];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Leave management</h1>
          <p className="text-xs text-muted-foreground">Student and staff leave requests</p>
        </div>
        {can("leave.submit") && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" />
            Apply for leave
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={requests}
        getRowId={(r) => r.id}
        caption="Leave requests"
        renderMobileCard={(r) => (
          <div className="surface-3d flex flex-col gap-1 rounded-lg border border-border bg-surface p-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">{r.applicantName}</p>
              <Badge tone={leaveStatusTone[r.status]}>{r.status.replace("-", " ")}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {leaveTypeLabels[r.leaveType]} · {formatDate(r.startDate)} – {formatDate(r.endDate)}
            </p>
            {can("leave.approve") && r.status === "submitted" && (
              <div className="mt-1 flex gap-xs">
                <Button size="sm" onClick={() => approveLeave(r.id, "Principal")}>
                  Approve
                </Button>
                <Button size="sm" variant="outline" className="text-error" onClick={() => setRejectTarget(r)}>
                  Reject
                </Button>
              </div>
            )}
          </div>
        )}
        rowActions={
          can("leave.approve")
            ? [
                { key: "approve", label: "Approve", onSelect: (r) => approveLeave(r.id, "Principal"), hidden: (r) => r.status !== "submitted" && r.status !== "under-review" },
                { key: "reject", label: "Reject", onSelect: (r) => setRejectTarget(r), destructive: true, hidden: (r) => r.status !== "submitted" && r.status !== "under-review" },
                { key: "cancel", label: "Cancel", onSelect: (r) => cancelLeave(r.id), hidden: (r) => r.status === "cancelled" || r.status === "rejected" },
              ]
            : undefined
        }
        emptyTitle="No leave requests"
      />

      <DetailDrawer open={createOpen} onOpenChange={setCreateOpen} title="Apply for leave" description="Submit a leave request for review">
        <form
          onSubmit={form.handleSubmit((values) => {
            submitLeaveRequest({ ...values, applicantType: "staff", applicantId: "teacher-1", applicantName: "Meera Krishnan" });
            setCreateOpen(false);
            form.reset();
          })}
          className="flex flex-col gap-sm"
        >
          <div>
            <Label>Leave type</Label>
            <Controller
              control={form.control}
              name="leaveType"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger aria-label="Leave type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {leaveTypeOptions.map((t) => (
                      <SelectItem key={t} value={t}>
                        {leaveTypeLabels[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="grid grid-cols-2 gap-sm">
            <div>
              <Label htmlFor="leave-start">Start date</Label>
              <Input id="leave-start" type="date" {...form.register("startDate")} />
            </div>
            <div>
              <Label htmlFor="leave-end">End date</Label>
              <Input id="leave-end" type="date" {...form.register("endDate")} />
              <FieldError>{form.formState.errors.endDate?.message}</FieldError>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-md border border-border px-sm py-sm">
            <span className="text-sm text-foreground">Half day</span>
            <Controller control={form.control} name="halfDay" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
          </div>
          <div>
            <Label htmlFor="leave-reason">Reason</Label>
            <Textarea id="leave-reason" rows={3} {...form.register("reason")} />
            <FieldError>{form.formState.errors.reason?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="leave-emergency">Emergency contact</Label>
            <Input id="leave-emergency" {...form.register("emergencyContact")} />
          </div>
          <Button type="submit">Submit request</Button>
        </form>
      </DetailDrawer>

      <ConfirmDialog
        open={rejectTarget !== null}
        onOpenChange={(open) => !open && setRejectTarget(null)}
        title="Reject leave request?"
        description="The applicant will be notified that this request was rejected."
        confirmLabel="Reject"
        destructive
        onConfirm={() => rejectTarget && rejectLeave(rejectTarget.id, "Principal", "Not approved at this time.")}
      />
    </div>
  );
}
