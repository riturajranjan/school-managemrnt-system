"use client";

import { useFormContext } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { AdmissionFormValues } from "@/lib/schemas/admission-form";
import type { StepProps } from "../types";

export function PreviousSchoolStep(_props: StepProps) {
  const { register } = useFormContext<AdmissionFormValues>();
  return (
    <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
      <p className="text-xs text-muted-foreground sm:col-span-2">Leave blank if this is the student&apos;s first school.</p>
      <div>
        <Label htmlFor="previousSchool.schoolName">Previous school name</Label>
        <Input id="previousSchool.schoolName" {...register("previousSchool.schoolName")} />
      </div>
      <div>
        <Label htmlFor="previousSchool.board">Board</Label>
        <Input id="previousSchool.board" placeholder="CBSE / ICSE / State Board" {...register("previousSchool.board")} />
      </div>
      <div>
        <Label htmlFor="previousSchool.lastClassCompleted">Last class completed</Label>
        <Input id="previousSchool.lastClassCompleted" {...register("previousSchool.lastClassCompleted")} />
      </div>
      <div>
        <Label htmlFor="previousSchool.yearOfLeaving">Year of leaving</Label>
        <Input id="previousSchool.yearOfLeaving" {...register("previousSchool.yearOfLeaving")} />
      </div>
      <div>
        <Label htmlFor="previousSchool.tcNumber">Transfer certificate number</Label>
        <Input id="previousSchool.tcNumber" {...register("previousSchool.tcNumber")} />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="previousSchool.reasonForLeaving">Reason for leaving</Label>
        <Input id="previousSchool.reasonForLeaving" {...register("previousSchool.reasonForLeaving")} />
      </div>
    </div>
  );
}
