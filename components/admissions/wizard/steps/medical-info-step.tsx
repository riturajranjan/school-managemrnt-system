"use client";

import { useFormContext } from "react-hook-form";
import { FieldError, Label } from "@/components/ui/label";
import { Input, Textarea } from "@/components/ui/input";
import type { AdmissionFormValues } from "@/lib/schemas/admission-form";
import type { StepProps } from "../types";

export function MedicalInfoStep(_props: StepProps) {
  const { register, formState: { errors } } = useFormContext<AdmissionFormValues>();
  return (
    <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Label htmlFor="medicalInfo.allergies">Allergies</Label>
        <Textarea id="medicalInfo.allergies" rows={2} {...register("medicalInfo.allergies")} />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="medicalInfo.conditions">Ongoing medical conditions</Label>
        <Textarea id="medicalInfo.conditions" rows={2} {...register("medicalInfo.conditions")} />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="medicalInfo.medications">Current medications</Label>
        <Textarea id="medicalInfo.medications" rows={2} {...register("medicalInfo.medications")} />
      </div>
      <div>
        <Label htmlFor="medicalInfo.emergencyContact">Emergency contact name *</Label>
        <Input id="medicalInfo.emergencyContact" {...register("medicalInfo.emergencyContact")} aria-invalid={!!errors.medicalInfo?.emergencyContact} />
        <FieldError>{errors.medicalInfo?.emergencyContact?.message}</FieldError>
      </div>
      <div>
        <Label htmlFor="medicalInfo.emergencyPhone">Emergency phone *</Label>
        <Input id="medicalInfo.emergencyPhone" type="tel" inputMode="tel" {...register("medicalInfo.emergencyPhone")} aria-invalid={!!errors.medicalInfo?.emergencyPhone} />
        <FieldError>{errors.medicalInfo?.emergencyPhone?.message}</FieldError>
      </div>
      <div>
        <Label htmlFor="medicalInfo.physicianName">Family physician</Label>
        <Input id="medicalInfo.physicianName" {...register("medicalInfo.physicianName")} />
      </div>
    </div>
  );
}
