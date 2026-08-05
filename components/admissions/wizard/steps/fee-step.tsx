"use client";

import { Controller, useFormContext } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { AdmissionFormValues } from "@/lib/schemas/admission-form";
import type { StepProps } from "../types";

export function FeeStep(_props: StepProps) {
  const { control, register, watch } = useFormContext<AdmissionFormValues>();
  const paid = watch("feeDetails.applicationFeePaid");

  return (
    <div className="flex flex-col gap-md">
      <div className="flex items-center justify-between rounded-md border border-border px-sm py-sm">
        <div>
          <p className="text-sm font-medium text-foreground">Application fee paid</p>
          <p className="text-xs text-muted-foreground">Non-refundable processing fee for this application</p>
        </div>
        <Controller control={control} name="feeDetails.applicationFeePaid" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
      </div>
      {paid && (
        <div>
          <Label htmlFor="feeDetails.applicationFeeReference">Payment reference</Label>
          <Input id="feeDetails.applicationFeeReference" {...register("feeDetails.applicationFeeReference")} />
        </div>
      )}
      <p className="text-xs text-muted-foreground">Admission fee and installment structure are configured after approval, during enrollment.</p>
    </div>
  );
}
