"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { FieldError, Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { roleLabels } from "@/lib/permissions/roles";
import { schoolClasses } from "@/lib/data/seed/reference";
import { createAdmissionRequest } from "@/lib/hooks/api/use-admissions";

// Real create form. On submit it POSTs to /api/admissions (authoritative) and
// opens the created application's workspace. The elaborate multi-step draft
// wizard (previous school / medical / transport / hostel / fee) has been retired
// in favour of this real flow; those optional detail sections can be captured on
// the application later once their capture UIs are rebuilt against the API.
const schema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  dob: z.string().optional().or(z.literal("")),
  gender: z.enum(["male", "female", "other", "prefer-not-to-say"]),
  appliedClassId: z.string().optional().or(z.literal("")),
  admissionType: z.enum(["new", "transfer", "sibling", "staff-ward", "management-quota"]),
  source: z.enum(["website", "walk-in", "referral", "social-media", "education-fair", "agent", "phone-enquiry"]),
  priority: z.enum(["high", "medium", "low"]),
  email: z.string().email("Enter a valid email").optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  guardianFirstName: z.string().trim().min(1, "Guardian first name is required"),
  guardianLastName: z.string().trim().min(1, "Guardian last name is required"),
  guardianPhone: z.string().optional().or(z.literal("")),
  guardianEmail: z.string().email("Enter a valid email").optional().or(z.literal("")),
});

type Values = z.infer<typeof schema>;

export default function NewAdmissionPage() {
  const router = useRouter();
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { gender: "prefer-not-to-say", admissionType: "new", source: "website", priority: "medium" },
  });

  if (!capabilitiesLoading && !hasServerPermission("admissions.view")) {
    return <PermissionDenied action="create an admission application" role={roleLabels[role]} backHref="/admissions" />;
  }

  async function onSubmit(values: Values) {
    setSubmitError(null);
    setSubmitting(true);
    const appliedClass = schoolClasses.find((c) => c.id === values.appliedClassId)?.name;
    const res = await createAdmissionRequest({
      firstName: values.firstName,
      lastName: values.lastName,
      dateOfBirth: values.dob || undefined,
      gender: values.gender,
      appliedClass,
      admissionType: values.admissionType,
      source: values.source,
      priority: values.priority,
      email: values.email || undefined,
      phone: values.phone || undefined,
      guardians: [
        {
          firstName: values.guardianFirstName,
          lastName: values.guardianLastName,
          phone: values.guardianPhone || undefined,
          email: values.guardianEmail || undefined,
          relation: "guardian" as const,
          isPrimary: true,
          isEmergencyContact: true,
          authorizedPickup: true,
        },
      ],
    });
    setSubmitting(false);
    if (!res.success) {
      setSubmitError(res.error.message);
      return;
    }
    router.push(`/admissions/${res.data.id}`);
  }

  return (
    <div className="mx-auto flex flex-col gap-md">
      <h1 className="text-lg font-semibold text-foreground">New application</h1>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-md rounded-lg border border-border bg-surface p-md">
        {submitError && <p className="rounded-md border border-error/30 bg-error/10 p-sm text-xs text-error">{submitError}</p>}

        <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
          <div>
            <Label htmlFor="firstName">First name *</Label>
            <Input id="firstName" {...form.register("firstName")} aria-invalid={!!form.formState.errors.firstName} />
            <FieldError>{form.formState.errors.firstName?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="lastName">Last name *</Label>
            <Input id="lastName" {...form.register("lastName")} aria-invalid={!!form.formState.errors.lastName} />
            <FieldError>{form.formState.errors.lastName?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="dob">Date of birth</Label>
            <Input id="dob" type="date" {...form.register("dob")} />
          </div>
          <div>
            <Label>Gender</Label>
            <Controller
              control={form.control}
              name="gender"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger aria-label="Gender">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                    <SelectItem value="prefer-not-to-say">Prefer not to say</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div>
            <Label>Applied class</Label>
            <Controller
              control={form.control}
              name="appliedClassId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger aria-label="Applied class">
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    {schoolClasses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div>
            <Label>Admission type</Label>
            <Controller
              control={form.control}
              name="admissionType"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger aria-label="Admission type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="transfer">Transfer</SelectItem>
                    <SelectItem value="sibling">Sibling</SelectItem>
                    <SelectItem value="staff-ward">Staff ward</SelectItem>
                    <SelectItem value="management-quota">Management quota</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div>
            <Label>Source</Label>
            <Controller
              control={form.control}
              name="source"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger aria-label="Source">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="website">Website</SelectItem>
                    <SelectItem value="walk-in">Walk-in</SelectItem>
                    <SelectItem value="referral">Referral</SelectItem>
                    <SelectItem value="social-media">Social media</SelectItem>
                    <SelectItem value="education-fair">Education fair</SelectItem>
                    <SelectItem value="agent">Agent</SelectItem>
                    <SelectItem value="phone-enquiry">Phone enquiry</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div>
            <Label>Priority</Label>
            <Controller
              control={form.control}
              name="priority"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger aria-label="Priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div>
            <Label htmlFor="email">Applicant email</Label>
            <Input id="email" type="email" {...form.register("email")} aria-invalid={!!form.formState.errors.email} />
            <FieldError>{form.formState.errors.email?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="phone">Applicant phone</Label>
            <Input id="phone" type="tel" {...form.register("phone")} />
          </div>
        </div>

        <div className="border-t border-border pt-md">
          <h2 className="mb-sm text-sm font-semibold text-foreground">Primary guardian</h2>
          <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
            <div>
              <Label htmlFor="guardianFirstName">First name *</Label>
              <Input id="guardianFirstName" {...form.register("guardianFirstName")} aria-invalid={!!form.formState.errors.guardianFirstName} />
              <FieldError>{form.formState.errors.guardianFirstName?.message}</FieldError>
            </div>
            <div>
              <Label htmlFor="guardianLastName">Last name *</Label>
              <Input id="guardianLastName" {...form.register("guardianLastName")} aria-invalid={!!form.formState.errors.guardianLastName} />
              <FieldError>{form.formState.errors.guardianLastName?.message}</FieldError>
            </div>
            <div>
              <Label htmlFor="guardianPhone">Phone</Label>
              <Input id="guardianPhone" type="tel" {...form.register("guardianPhone")} />
            </div>
            <div>
              <Label htmlFor="guardianEmail">Email</Label>
              <Input id="guardianEmail" type="email" {...form.register("guardianEmail")} aria-invalid={!!form.formState.errors.guardianEmail} />
              <FieldError>{form.formState.errors.guardianEmail?.message}</FieldError>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-sm border-t border-border pt-md">
          <Button type="button" variant="outline" disabled={submitting} onClick={() => router.push("/admissions")}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating…" : "Create application"}
          </Button>
        </div>
      </form>
    </div>
  );
}
