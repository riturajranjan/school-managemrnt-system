"use client";

import { Controller, useFormContext } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { AdmissionFormValues } from "@/lib/schemas/admission-form";
import type { StepProps } from "../types";

export function HostelStep(_props: StepProps) {
  const { control, watch } = useFormContext<AdmissionFormValues>();
  const required = watch("hostel.required");

  return (
    <div className="flex flex-col gap-md">
      <div className="flex items-center justify-between rounded-md border border-border px-sm py-sm">
        <div>
          <p className="text-sm font-medium text-foreground">Hostel accommodation required</p>
          <p className="text-xs text-muted-foreground">The student will need a boarding assignment</p>
        </div>
        <Controller control={control} name="hostel.required" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
      </div>

      {required && (
        <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
          <div>
            <Label>Block preference</Label>
            <Controller
              control={control}
              name="hostel.blockPreference"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger aria-label="Block preference">
                    <SelectValue placeholder="Select preference" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="boys">Boys</SelectItem>
                    <SelectItem value="girls">Girls</SelectItem>
                    <SelectItem value="co-ed">Co-ed</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>
      )}
    </div>
  );
}
