"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { createActivityEventRequest, useActivities } from "@/lib/hooks/api/use-activities-api";
import { roleLabels } from "@/lib/permissions/roles";

export default function NewEventPage() {
  const router = useRouter();
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: activities } = useActivities({ status: "active" });
  const [activityId, setActivityId] = useState("");
  const [title, setTitle] = useState("");
  const [startAt, setStartAt] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!capabilitiesLoading && !hasServerPermission("activities.manage")) return <PermissionDenied action="create events" role={roleLabels[role]} backHref="/activities/events" />;

  async function submit() {
    if (!activityId || !title.trim() || !startAt) return;
    const res = await createActivityEventRequest({ activityId, title, startAt: new Date(startAt).toISOString(), location: location || undefined, description: description || undefined });
    if (!res.success) { setError(res.error.message); return; }
    router.push(`/activities/events/${res.data.id}`);
  }

  return (
    <div className="mx-auto flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="ghost"><Link href="/activities/events"><ArrowLeft className="size-4" /></Link></Button>
        <div><h1 className="text-lg font-semibold text-foreground">New event</h1><p className="text-xs text-muted-foreground">Created as Draft — publish it to make it visible on the calendar.</p></div>
      </div>

      <div className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
        <div>
          <Label>Activity *</Label>
          <Select value={activityId} onValueChange={setActivityId}>
            <SelectTrigger aria-label="Activity"><SelectValue placeholder="Select activity" /></SelectTrigger>
            <SelectContent>{activities.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="evt-title">Title</Label>
          <Input id="evt-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Annual Day Celebration" />
        </div>
        <div className="grid grid-cols-2 gap-sm">
          <div>
            <Label htmlFor="evt-date">Start date & time</Label>
            <Input id="evt-date" type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="evt-venue">Location</Label>
            <Input id="evt-venue" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Main Auditorium" />
          </div>
        </div>
        <div>
          <Label htmlFor="evt-desc">Description</Label>
          <Textarea id="evt-desc" value={description} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)} rows={2} placeholder="Short description" />
        </div>
        {error && <p className="rounded-md border border-error/30 bg-error/8 p-sm text-xs text-error">{error}</p>}
        <div className="flex justify-end gap-xs">
          <Button asChild size="sm" variant="ghost"><Link href="/activities/events">Cancel</Link></Button>
          <Button size="sm" onClick={submit} disabled={!activityId || !title.trim() || !startAt}>Create event</Button>
        </div>
      </div>
    </div>
  );
}
