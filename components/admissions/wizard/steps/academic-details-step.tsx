"use client";

import { useFormContext } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Input, Textarea } from "@/components/ui/input";
import type { AdmissionFormValues } from "@/lib/schemas/admission-form";
import type { StepProps } from "../types";

export function AcademicDetailsStep(_props: StepProps) {
  const { register } = useFormContext<AdmissionFormValues>();
  return (
    <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
      <div>
        <Label htmlFor="academicDetails.preferredSecondLanguage">Preferred second language</Label>
        <Input id="academicDetails.preferredSecondLanguage" {...register("academicDetails.preferredSecondLanguage")} />
      </div>
      <div>
        <Label htmlFor="academicDetails.siblingStudentId">Sibling admission number (if any)</Label>
        <Input id="academicDetails.siblingStudentId" {...register("academicDetails.siblingStudentId")} />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="academicDetails.extracurricularInterests">Extracurricular interests</Label>
        <Textarea id="academicDetails.extracurricularInterests" rows={3} {...register("academicDetails.extracurricularInterests")} />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="academicDetails.specialNeeds">Special learning needs / accommodations</Label>
        <Textarea id="academicDetails.specialNeeds" rows={3} {...register("academicDetails.specialNeeds")} />
      </div>
    </div>
  );
}
