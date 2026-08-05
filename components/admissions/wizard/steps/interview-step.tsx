"use client";

import { Controller, useFormContext } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AdmissionFormValues } from "@/lib/schemas/admission-form";
import type { StepProps } from "../types";

export function InterviewStep(_props: StepProps) {
  const { control, register } = useFormContext<AdmissionFormValues>();
  return (
    <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
      <p className="text-xs text-muted-foreground sm:col-span-2">
        This records the family&apos;s preference — the admissions team confirms an exact slot from the applicant workspace.
      </p>
      <div>
        <Label htmlFor="interview.preferredSlot">Preferred date/time</Label>
        <Input id="interview.preferredSlot" type="datetime-local" {...register("interview.preferredSlot")} />
      </div>
      <div>
        <Label>Preferred mode</Label>
        <Controller
          control={control}
          name="interview.preferredMode"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger aria-label="Preferred interview mode">
                <SelectValue placeholder="No preference" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in-person">In person</SelectItem>
                <SelectItem value="video">Video call</SelectItem>
                <SelectItem value="phone">Phone call</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </div>
    </div>
  );
}
