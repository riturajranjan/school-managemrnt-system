"use client";

import { Controller, useFormContext } from "react-hook-form";
import { FieldError, Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { schoolClasses } from "@/lib/data/seed/reference";
import type { AdmissionFormValues } from "@/lib/schemas/admission-form";
import type { StepProps } from "../types";

const genderOptions = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
  { value: "prefer-not-to-say", label: "Prefer not to say" },
];

const admissionTypeOptions = [
  { value: "new", label: "New admission" },
  { value: "transfer", label: "Transfer" },
  { value: "sibling", label: "Sibling admission" },
  { value: "staff-ward", label: "Staff ward" },
  { value: "management-quota", label: "Management quota" },
];

export function StudentDetailsStep(_props: StepProps) {
  const { register, control, watch, formState: { errors } } = useFormContext<AdmissionFormValues>();
  const appliedClassId = watch("appliedClassId");
  const sections = schoolClasses.find((c) => c.id === appliedClassId)?.sections ?? [];

  return (
    <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
      <div>
        <Label htmlFor="firstName">First name *</Label>
        <Input id="firstName" autoComplete="given-name" {...register("firstName")} aria-invalid={!!errors.firstName} />
        <FieldError>{errors.firstName?.message}</FieldError>
      </div>
      <div>
        <Label htmlFor="middleName">Middle name</Label>
        <Input id="middleName" {...register("middleName")} />
      </div>
      <div>
        <Label htmlFor="lastName">Last name *</Label>
        <Input id="lastName" autoComplete="family-name" {...register("lastName")} aria-invalid={!!errors.lastName} />
        <FieldError>{errors.lastName?.message}</FieldError>
      </div>
      <div>
        <Label htmlFor="preferredName">Preferred name</Label>
        <Input id="preferredName" {...register("preferredName")} />
      </div>
      <div>
        <Label htmlFor="dob">Date of birth *</Label>
        <Input id="dob" type="date" {...register("dob")} aria-invalid={!!errors.dob} />
        <FieldError>{errors.dob?.message}</FieldError>
      </div>
      <div>
        <Label>Gender *</Label>
        <Controller
          control={control}
          name="gender"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger aria-label="Gender">
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                {genderOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>
      <div>
        <Label htmlFor="bloodGroup">Blood group</Label>
        <Input id="bloodGroup" placeholder="e.g. O+" {...register("bloodGroup")} />
      </div>
      <div>
        <Label htmlFor="nationality">Nationality *</Label>
        <Input id="nationality" {...register("nationality")} aria-invalid={!!errors.nationality} />
        <FieldError>{errors.nationality?.message}</FieldError>
      </div>
      <div>
        <Label htmlFor="religion">Religion (optional)</Label>
        <Input id="religion" {...register("religion")} />
      </div>
      <div>
        <Label htmlFor="category">Category (optional)</Label>
        <Input id="category" {...register("category")} />
      </div>
      <div>
        <Label htmlFor="motherTongue">Mother tongue</Label>
        <Input id="motherTongue" {...register("motherTongue")} />
      </div>
      <div>
        <Label htmlFor="photoUrl">Student photo</Label>
        <Controller
          control={control}
          name="photoUrl"
          render={({ field }) => (
            <Input
              id="photoUrl"
              type="file"
              accept="image/*"
              onChange={(e) => field.onChange(e.target.files?.[0]?.name ?? "")}
            />
          )}
        />
        {watch("photoUrl") && <p className="mt-xs text-xs text-muted-foreground">Selected: {watch("photoUrl")}</p>}
      </div>

      <div className="sm:col-span-2">
        <div className="h-px bg-border" />
      </div>

      <div>
        <Label>Applied class *</Label>
        <Controller
          control={control}
          name="appliedClassId"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger aria-label="Applied class" aria-invalid={!!errors.appliedClassId}>
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
        <FieldError>{errors.appliedClassId?.message}</FieldError>
      </div>
      <div>
        <Label>Applied section (preference)</Label>
        <Controller
          control={control}
          name="appliedSectionPreference"
          render={({ field }) => (
            <Select value={field.value || undefined} onValueChange={field.onChange} disabled={sections.length === 0}>
              <SelectTrigger aria-label="Applied section preference">
                <SelectValue placeholder="No preference" />
              </SelectTrigger>
              <SelectContent>
                {sections.map((s) => (
                  <SelectItem key={s.id} value={s.name}>
                    Section {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>
      <div>
        <Label>Admission type *</Label>
        <Controller
          control={control}
          name="admissionType"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger aria-label="Admission type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {admissionTypeOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>
      <div>
        <Label htmlFor="session">Academic session *</Label>
        <Input id="session" {...register("session")} readOnly className="bg-surface-secondary" />
      </div>
    </div>
  );
}
