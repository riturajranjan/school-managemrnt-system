"use client";

// Real Staff create/edit form (Phase 9J) — wired to POST/PATCH /api/staff.
// Fields match the real Staff model exactly (Phase 6A): no department/
// designation picker (plain text on Staff, no separate model), no gender/DOB/
// address/reporting-manager/bank/emergency-contact/qualification fields —
// those were mock-only (lib/schemas/hr-form.ts) with nothing real backing
// them and are dropped, not carried forward. A single page, not the old
// 6-step wizard: every one of the wizard's later steps mapped to fields that
// don't exist on the real Staff row.
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { FieldError, Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { createStaffRequest, updateStaffRequest } from "@/lib/hooks/api/use-staff-api";
import type { StaffDetailDto } from "@/lib/api/contracts";

const formSchema = z.object({
  employeeCode: z.string().trim().min(1, "Employee code is required").max(24),
  firstName: z.string().trim().min(1, "First name is required").max(60),
  lastName: z.string().trim().max(60).optional(),
  displayName: z.string().trim().max(120).optional(),
  email: z.string().trim().email("Enter a valid email").max(320).optional().or(z.literal("")),
  phone: z.string().trim().max(32).optional(),
  designation: z.string().trim().max(60).optional(),
  department: z.string().trim().max(60).optional(),
  employmentType: z.enum(["full-time", "part-time", "contract", "temporary"]).optional(),
  isTeaching: z.boolean(),
  joiningDate: z.string().optional(),
});
type FormValues = z.infer<typeof formSchema>;

export function StaffForm({ staff }: { staff?: StaffDetailDto }) {
  const router = useRouter();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: staff
      ? {
          employeeCode: staff.employeeCode, firstName: staff.firstName, lastName: staff.lastName ?? "",
          displayName: staff.displayName ?? "", email: staff.email ?? "", phone: staff.phone ?? "",
          designation: staff.designation ?? "", department: staff.department ?? "",
          employmentType: staff.employmentType ?? undefined, isTeaching: staff.isTeaching,
          joiningDate: staff.joiningDate ?? "",
        }
      : { isTeaching: false },
  });

  async function onSubmit(values: FormValues) {
    setSaving(true);
    setSaveError(null);
    const body = {
      employeeCode: values.employeeCode, firstName: values.firstName,
      lastName: values.lastName || undefined, displayName: values.displayName || undefined,
      email: values.email || undefined, phone: values.phone || undefined,
      designation: values.designation || undefined, department: values.department || undefined,
      employmentType: values.employmentType, isTeaching: values.isTeaching,
      joiningDate: values.joiningDate || undefined,
    };
    const res = staff ? await updateStaffRequest(staff.id, body) : await createStaffRequest(body);
    if (!res.success) {
      setSaveError(res.error.message);
      setSaving(false);
      return;
    }
    router.push(`/hr/staff/${res.data.id}`);
  }

  return (
    <form className="flex flex-col gap-md rounded-lg border border-border bg-surface p-md" onSubmit={form.handleSubmit(onSubmit)}>
      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
        <div>
          <Label htmlFor="staff-code">Employee code</Label>
          <Input id="staff-code" {...form.register("employeeCode")} />
          <FieldError>{form.formState.errors.employeeCode?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="staff-display">Display name (optional)</Label>
          <Input id="staff-display" {...form.register("displayName")} />
        </div>
        <div>
          <Label htmlFor="staff-first">First name</Label>
          <Input id="staff-first" {...form.register("firstName")} />
          <FieldError>{form.formState.errors.firstName?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="staff-last">Last name</Label>
          <Input id="staff-last" {...form.register("lastName")} />
        </div>
        <div>
          <Label htmlFor="staff-email">Email</Label>
          <Input id="staff-email" type="email" {...form.register("email")} />
          <FieldError>{form.formState.errors.email?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="staff-phone">Phone</Label>
          <Input id="staff-phone" {...form.register("phone")} />
        </div>
        <div>
          <Label htmlFor="staff-designation">Designation</Label>
          <Input id="staff-designation" {...form.register("designation")} placeholder="e.g. PGT Mathematics" />
        </div>
        <div>
          <Label htmlFor="staff-department">Department</Label>
          <Input id="staff-department" {...form.register("department")} placeholder="e.g. Science" />
        </div>
        <div>
          <Label htmlFor="staff-employment-type">Employment type</Label>
          <Controller
            control={form.control}
            name="employmentType"
            render={({ field }) => (
              <Select value={field.value ?? ""} onValueChange={field.onChange}>
                <SelectTrigger id="staff-employment-type"><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="full-time">Full-time</SelectItem>
                  <SelectItem value="part-time">Part-time</SelectItem>
                  <SelectItem value="contract">Contract</SelectItem>
                  <SelectItem value="temporary">Temporary</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div>
          <Label htmlFor="staff-joining">Joining date</Label>
          <Input id="staff-joining" type="date" {...form.register("joiningDate")} />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-md border border-border p-sm">
        <div>
          <p className="text-sm font-medium text-foreground">Teaching eligible</p>
          <p className="text-xs text-muted-foreground">Makes this staff member available for TeachingAssignments (the Teachers directory).</p>
        </div>
        <Controller control={form.control} name="isTeaching" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
      </div>

      {saveError && <p className="text-sm text-error">{saveError}</p>}

      <div className="flex gap-xs">
        <Button type="submit" disabled={saving}>{staff ? "Save changes" : "Add staff"}</Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
      </div>
    </form>
  );
}
