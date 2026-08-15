"use client";

// Real PostgreSQL/API cutover (Phase 9E.2) — reads/writes the live
// /api/leave/* endpoints. Own requests for self-service staff, all school
// requests for a broad leave manager (server-resolved, never client-filtered).
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
import { approveLeaveRequest, cancelLeaveRequest, rejectLeaveRequest, submitLeaveRequest, useLeaveRequests, useLeaveTypes } from "@/lib/hooks/api/use-leave-api";
import { leaveFormSchema, type LeaveFormValues } from "@/lib/schemas/academics-form";
import type { LeaveRequestDto, LeaveRequestStatusDto } from "@/lib/api/contracts";
import { formatDate } from "@/lib/utils";

const leaveStatusTone: Record<LeaveRequestStatusDto, "success" | "warning" | "error" | "info" | "neutral"> = {
  pending: "warning", approved: "success", rejected: "error", cancelled: "neutral",
};

export default function LeavePage() {
  const { data: requests, loading, error, reload } = useLeaveRequests();
  const { data: leaveTypes } = useLeaveTypes();
  const { can } = usePermissions();
  const [createOpen, setCreateOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<LeaveRequestDto | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<LeaveFormValues>({
    resolver: zodResolver(leaveFormSchema),
    defaultValues: { leaveTypeId: "", halfDay: false, startDate: new Date().toISOString().slice(0, 10), endDate: new Date().toISOString().slice(0, 10), reason: "" },
  });

  const columns: ColumnDef<LeaveRequestDto>[] = [
    {
      id: "applicant",
      header: "Staff",
      alwaysVisible: true,
      sortValue: (r) => r.staffName,
      cell: (r) => <p className="text-sm font-medium text-foreground">{r.staffName}</p>,
    },
    { id: "type", header: "Type", cell: (r) => <span className="text-sm text-foreground">{r.leaveTypeName}</span> },
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
    { id: "status", header: "Status", align: "right", cell: (r) => <Badge tone={leaveStatusTone[r.status]}>{r.status}</Badge> },
  ];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Leave management</h1>
          <p className="text-xs text-muted-foreground">Staff leave requests</p>
        </div>
        {can("leave.submit") && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" />
            Apply for leave
          </Button>
        )}
      </div>

      {error && <p className="rounded-md border border-error/30 bg-error/8 p-sm text-sm text-error">{error}</p>}
      {loading && requests.length === 0 && <p className="text-xs text-muted-foreground">Loading…</p>}

      <DataTable
        columns={columns}
        rows={requests}
        getRowId={(r) => r.id}
        caption="Leave requests"
        renderMobileCard={(r) => (
          <div className="surface-3d flex flex-col gap-1 rounded-lg border border-border bg-surface p-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">{r.staffName}</p>
              <Badge tone={leaveStatusTone[r.status]}>{r.status}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {r.leaveTypeName} · {formatDate(r.startDate)} – {formatDate(r.endDate)}
            </p>
            {can("leave.approve") && r.status === "pending" && (
              <div className="mt-1 flex gap-xs">
                <Button size="sm" onClick={() => approveLeaveRequest(r.id).then(reload)}>
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
                { key: "approve", label: "Approve", onSelect: (r) => approveLeaveRequest(r.id).then(reload), hidden: (r) => r.status !== "pending" },
                { key: "reject", label: "Reject", onSelect: (r) => setRejectTarget(r), destructive: true, hidden: (r) => r.status !== "pending" },
                { key: "cancel", label: "Cancel", onSelect: (r) => cancelLeaveRequest(r.id).then(reload), hidden: (r) => r.status !== "pending" },
              ]
            : undefined
        }
        emptyTitle="No leave requests"
      />

      <DetailDrawer open={createOpen} onOpenChange={setCreateOpen} title="Apply for leave" description="Submit a leave request for review">
        <form
          onSubmit={form.handleSubmit(async (values) => {
            setFormError(null);
            const res = await submitLeaveRequest(values);
            if (!res.success) {
              setFormError(res.error.message);
              return;
            }
            setCreateOpen(false);
            form.reset();
            reload();
          })}
          className="flex flex-col gap-sm"
        >
          <div>
            <Label>Leave type</Label>
            <Controller
              control={form.control}
              name="leaveTypeId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger aria-label="Leave type">
                    <SelectValue placeholder="Select leave type" />
                  </SelectTrigger>
                  <SelectContent>
                    {(leaveTypes ?? []).map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError>{form.formState.errors.leaveTypeId?.message}</FieldError>
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
          {formError && <p className="rounded-md border border-error/30 bg-error/8 p-sm text-sm text-error">{formError}</p>}
          <Button type="submit" disabled={form.formState.isSubmitting}>Submit request</Button>
        </form>
      </DetailDrawer>

      <ConfirmDialog
        open={rejectTarget !== null}
        onOpenChange={(open) => !open && setRejectTarget(null)}
        title="Reject leave request?"
        description="The applicant will be notified that this request was rejected."
        confirmLabel="Reject"
        destructive
        onConfirm={async () => {
          if (!rejectTarget) return;
          await rejectLeaveRequest(rejectTarget.id, { reviewNote: "Not approved at this time." });
          reload();
        }}
      />
    </div>
  );
}
