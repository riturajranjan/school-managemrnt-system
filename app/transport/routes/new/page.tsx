"use client";

// New route (Phase 9M) — real PostgreSQL/API cutover. Stops, vehicle and
// crew are configured on the route detail page after creation (a route must
// exist before stops/assignment can reference it).
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, Label } from "@/components/ui/label";
import { Input, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { createRouteRequest } from "@/lib/hooks/api/use-transport-api";
import { roleLabels } from "@/lib/permissions/roles";

const formSchema = z.object({
  name: z.string().trim().min(1, "Route name is required"),
  code: z.string().trim().min(1, "Route code is required"),
  shift: z.enum(["morning", "afternoon", "evening", "both"]).optional(),
  direction: z.enum(["pickup", "drop", "both"]).optional(),
  capacity: z.number().int().min(1).optional(),
  notes: z.string().trim().optional(),
});
type FormValues = z.infer<typeof formSchema>;

export default function NewRoutePage() {
  const router = useRouter();
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const form = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: { shift: "morning", direction: "both" } });

  if (!capabilitiesLoading && !hasServerPermission("transport.manage")) return <PermissionDenied action="create routes" role={roleLabels[role]} backHref="/transport/routes" />;

  async function onSubmit(values: FormValues) {
    setSaving(true);
    setSaveError(null);
    const res = await createRouteRequest({ name: values.name, code: values.code, shift: values.shift, direction: values.direction, capacity: values.capacity, notes: values.notes || undefined });
    if (!res.success) {
      setSaveError(res.error.message);
      setSaving(false);
      return;
    }
    router.push(`/transport/routes/${res.data.id}`);
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-sm">
        <Button asChild size="icon" variant="ghost" aria-label="Back"><Link href="/transport/routes"><ArrowLeft className="size-4" /></Link></Button>
        <div>
          <h1 className="text-lg font-semibold text-foreground">New route</h1>
          <p className="text-xs text-muted-foreground">Add stops and assign a vehicle/crew after creating</p>
        </div>
      </div>

      <form className="flex flex-col gap-md rounded-lg border border-border bg-surface p-md" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
          <div>
            <Label htmlFor="rt-name">Route name</Label>
            <Input id="rt-name" {...form.register("name")} placeholder="North Zone Morning" />
            <FieldError>{form.formState.errors.name?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="rt-code">Route code</Label>
            <Input id="rt-code" {...form.register("code")} placeholder="RT-01" />
            <FieldError>{form.formState.errors.code?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="rt-shift">Shift</Label>
            <Controller
              control={form.control} name="shift"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="rt-shift"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="morning">Morning</SelectItem>
                    <SelectItem value="afternoon">Afternoon</SelectItem>
                    <SelectItem value="evening">Evening</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div>
            <Label htmlFor="rt-direction">Direction</Label>
            <Controller
              control={form.control} name="direction"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="rt-direction"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pickup">Pickup</SelectItem>
                    <SelectItem value="drop">Drop</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div>
            <Label htmlFor="rt-capacity">Capacity (optional)</Label>
            <Input id="rt-capacity" type="number" min={1} {...form.register("capacity", { valueAsNumber: true })} />
          </div>
        </div>
        <div>
          <Label htmlFor="rt-notes">Notes (optional)</Label>
          <Textarea id="rt-notes" rows={3} {...form.register("notes")} />
        </div>

        {saveError && <p className="text-sm text-error">{saveError}</p>}
        <div className="flex gap-xs">
          <Button type="submit" disabled={saving}>Create route</Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
