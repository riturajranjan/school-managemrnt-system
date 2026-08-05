"use client";

import { useFormContext } from "react-hook-form";
import { FieldError, Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { AdmissionFormValues } from "@/lib/schemas/admission-form";
import type { StepProps } from "../types";

export function AddressStep(_props: StepProps) {
  const { register, formState: { errors } } = useFormContext<AdmissionFormValues>();
  return (
    <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Label htmlFor="line1">Address line 1 *</Label>
        <Input id="line1" autoComplete="address-line1" {...register("line1")} aria-invalid={!!errors.line1} />
        <FieldError>{errors.line1?.message}</FieldError>
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="line2">Address line 2</Label>
        <Input id="line2" autoComplete="address-line2" {...register("line2")} />
      </div>
      <div>
        <Label htmlFor="city">City *</Label>
        <Input id="city" autoComplete="address-level2" {...register("city")} aria-invalid={!!errors.city} />
        <FieldError>{errors.city?.message}</FieldError>
      </div>
      <div>
        <Label htmlFor="state">State *</Label>
        <Input id="state" autoComplete="address-level1" {...register("state")} aria-invalid={!!errors.state} />
        <FieldError>{errors.state?.message}</FieldError>
      </div>
      <div>
        <Label htmlFor="postalCode">Postal code *</Label>
        <Input id="postalCode" inputMode="numeric" autoComplete="postal-code" {...register("postalCode")} aria-invalid={!!errors.postalCode} />
        <FieldError>{errors.postalCode?.message}</FieldError>
      </div>
      <div>
        <Label htmlFor="country">Country *</Label>
        <Input id="country" autoComplete="country-name" {...register("country")} aria-invalid={!!errors.country} />
        <FieldError>{errors.country?.message}</FieldError>
      </div>
    </div>
  );
}
