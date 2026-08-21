"use client";

// Add vehicle (Phase 9M) — real PostgreSQL/API cutover.
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { createVehicleRequest } from "@/lib/hooks/api/use-transport-api";
import { roleLabels } from "@/lib/permissions/roles";

const formSchema = z.object({
  registrationNumber: z.string().trim().min(1, "Registration number is required"),
  displayName: z.string().trim().optional(),
  type: z.enum(["bus", "mini-bus", "van", "car", "electric-vehicle", "contract-vehicle", "custom"]).optional(),
  make: z.string().trim().optional(),
  model: z.string().trim().optional(),
  capacity: z.number().int().min(1, "Capacity must be at least 1"),
});
type FormValues = z.infer<typeof formSchema>;

export default function NewVehiclePage() {
  const router = useRouter();
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const form = useForm<FormValues>({ resolver: zodResolver(formSchema) });

  if (!capabilitiesLoading && !hasServerPermission("transport.manage")) return <PermissionDenied action="add vehicles" role={roleLabels[role]} backHref="/transport/vehicles" />;

  async function onSubmit(values: FormValues) {
    setSaving(true);
    setSaveError(null);
    const res = await createVehicleRequest({
      registrationNumber: values.registrationNumber, displayName: values.displayName || undefined, type: values.type,
      make: values.make || undefined, model: values.model || undefined, capacity: values.capacity,
    });
    if (!res.success) {
      setSaveError(res.error.message);
      setSaving(false);
      return;
    }
    router.push(`/transport/vehicles/${res.data.id}`);
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-sm">
        <Button asChild size="icon" variant="ghost" aria-label="Back"><Link href="/transport/vehicles"><ArrowLeft className="size-4" /></Link></Button>
        <div>
          <h1 className="text-lg font-semibold text-foreground">Add vehicle</h1>
          <p className="text-xs text-muted-foreground">Creates a real vehicle record</p>
        </div>
      </div>

      <form className="flex flex-col gap-md rounded-lg border border-border bg-surface p-md" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
          <div>
            <Label htmlFor="veh-reg">Registration number</Label>
            <Input id="veh-reg" {...form.register("registrationNumber")} placeholder="KA-01-AB-1234" />
            <FieldError>{form.formState.errors.registrationNumber?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="veh-name">Display name (optional)</Label>
            <Input id="veh-name" {...form.register("displayName")} placeholder="Bus 12" />
          </div>
          <div>
            <Label htmlFor="veh-type">Type</Label>
            <Controller
              control={form.control}
              name="type"
              render={({ field }) => (
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <SelectTrigger id="veh-type"><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bus">Bus</SelectItem>
                    <SelectItem value="mini-bus">Mini bus</SelectItem>
                    <SelectItem value="van">Van</SelectItem>
                    <SelectItem value="car">Car</SelectItem>
                    <SelectItem value="electric-vehicle">Electric vehicle</SelectItem>
                    <SelectItem value="contract-vehicle">Contract vehicle</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div>
            <Label htmlFor="veh-capacity">Seating capacity</Label>
            <Input id="veh-capacity" type="number" min={1} {...form.register("capacity", { valueAsNumber: true })} />
            <FieldError>{form.formState.errors.capacity?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="veh-make">Make (optional)</Label>
            <Input id="veh-make" {...form.register("make")} />
          </div>
          <div>
            <Label htmlFor="veh-model">Model (optional)</Label>
            <Input id="veh-model" {...form.register("model")} />
          </div>
        </div>

        {saveError && <p className="text-sm text-error">{saveError}</p>}
        <div className="flex gap-xs">
          <Button type="submit" disabled={saving}>Add vehicle</Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
