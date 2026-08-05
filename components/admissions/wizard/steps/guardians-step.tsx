"use client";

import { Plus, Trash2 } from "lucide-react";
import { Controller, useFieldArray, useFormContext } from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldError, Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { AdmissionFormValues } from "@/lib/schemas/admission-form";
import { generateId } from "@/lib/utils";
import type { StepProps } from "../types";

const roleOptions = [
  { value: "father", label: "Father" },
  { value: "mother", label: "Mother" },
  { value: "guardian", label: "Guardian" },
];

const commPrefOptions = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "sms", label: "SMS" },
  { value: "email", label: "Email" },
  { value: "call", label: "Call" },
];

export function GuardiansStep(_props: StepProps) {
  const { control, register, watch, setValue, formState: { errors } } = useFormContext<AdmissionFormValues>();
  const { fields, append, remove } = useFieldArray({ control, name: "guardians" });
  const guardians = watch("guardians");

  function setPrimary(index: number) {
    guardians.forEach((_, i) => setValue(`guardians.${i}.isPrimary`, i === index));
  }

  return (
    <div className="flex flex-col gap-md">
      {typeof errors.guardians?.message === "string" && <FieldError>{errors.guardians.message}</FieldError>}

      {fields.map((field, index) => (
        <div key={field.id} className="rounded-lg border border-border p-sm sm:p-md">
          <div className="mb-sm flex items-center justify-between">
            <Controller
              control={control}
              name={`guardians.${index}.role`}
              render={({ field: roleField }) => (
                <Select value={roleField.value} onValueChange={roleField.onChange}>
                  <SelectTrigger className="w-40" aria-label="Relationship">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {fields.length > 1 && (
              <Button variant="ghost" size="sm" className="text-error" onClick={() => remove(index)} type="button">
                <Trash2 className="size-3.5" />
                Remove
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
            <div>
              <Label>First name *</Label>
              <Input {...register(`guardians.${index}.firstName`)} aria-invalid={!!errors.guardians?.[index]?.firstName} />
              <FieldError>{errors.guardians?.[index]?.firstName?.message}</FieldError>
            </div>
            <div>
              <Label>Last name *</Label>
              <Input {...register(`guardians.${index}.lastName`)} aria-invalid={!!errors.guardians?.[index]?.lastName} />
              <FieldError>{errors.guardians?.[index]?.lastName?.message}</FieldError>
            </div>
            <div>
              <Label>Occupation</Label>
              <Input {...register(`guardians.${index}.occupation`)} />
            </div>
            <div>
              <Label>Organization</Label>
              <Input {...register(`guardians.${index}.organization`)} />
            </div>
            <div>
              <Label>Phone *</Label>
              <Input type="tel" inputMode="tel" {...register(`guardians.${index}.phone`)} aria-invalid={!!errors.guardians?.[index]?.phone} />
              <FieldError>{errors.guardians?.[index]?.phone?.message}</FieldError>
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" inputMode="email" {...register(`guardians.${index}.email`)} aria-invalid={!!errors.guardians?.[index]?.email} />
              <FieldError>{errors.guardians?.[index]?.email?.message}</FieldError>
            </div>
            <div>
              <Label>Communication preference</Label>
              <Controller
                control={control}
                name={`guardians.${index}.communicationPreference`}
                render={({ field: prefField }) => (
                  <Select value={prefField.value} onValueChange={prefField.onChange}>
                    <SelectTrigger aria-label="Communication preference">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {commPrefOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="mt-sm flex flex-wrap gap-lg">
            <label className="flex items-center gap-xs text-sm text-foreground">
              <Checkbox checked={guardians[index]?.isPrimary} onCheckedChange={() => setPrimary(index)} />
              Primary contact
            </label>
            <label className="flex items-center gap-xs text-sm text-foreground">
              <Controller control={control} name={`guardians.${index}.isEmergencyContact`} render={({ field: f }) => <Checkbox checked={f.value} onCheckedChange={f.onChange} />} />
              Emergency contact
            </label>
            <label className="flex items-center gap-xs text-sm text-foreground">
              <Controller control={control} name={`guardians.${index}.authorizedPickup`} render={({ field: f }) => <Checkbox checked={f.value} onCheckedChange={f.onChange} />} />
              Authorized pickup
            </label>
          </div>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={() =>
          append({
            id: generateId("guardian"),
            role: "guardian",
            firstName: "",
            lastName: "",
            phone: "",
            isPrimary: fields.length === 0,
            isEmergencyContact: false,
            authorizedPickup: false,
            communicationPreference: "whatsapp",
          })
        }
      >
        <Plus className="size-3.5" />
        Add another parent or guardian
      </Button>
    </div>
  );
}
