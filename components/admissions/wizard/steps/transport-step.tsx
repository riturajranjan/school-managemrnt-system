"use client";

import { Controller, useFormContext } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { transportRoutes } from "@/lib/data/seed/reference";
import type { AdmissionFormValues } from "@/lib/schemas/admission-form";
import type { StepProps } from "../types";

export function TransportStep(_props: StepProps) {
  const { control, watch } = useFormContext<AdmissionFormValues>();
  const required = watch("transport.required");

  return (
    <div className="flex flex-col gap-md">
      <div className="flex items-center justify-between rounded-md border border-border px-sm py-sm">
        <div>
          <p className="text-sm font-medium text-foreground">School transport required</p>
          <p className="text-xs text-muted-foreground">The student will need a pickup/drop route</p>
        </div>
        <Controller control={control} name="transport.required" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
      </div>

      {required && (
        <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
          <div>
            <Label>Preferred route</Label>
            <Controller
              control={control}
              name="transport.routeId"
              render={({ field }) => (
                <Select value={field.value || undefined} onValueChange={field.onChange}>
                  <SelectTrigger aria-label="Preferred route">
                    <SelectValue placeholder="Select route" />
                  </SelectTrigger>
                  <SelectContent>
                    {transportRoutes.map((route) => (
                      <SelectItem key={route.id} value={route.id}>
                        {route.name} ({route.occupied}/{route.capacity})
                      </SelectItem>
                    ))}
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
