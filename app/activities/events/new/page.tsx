"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { createEvent } from "@/lib/services/activities-service";
import { roleLabels } from "@/lib/permissions/roles";
import {
  eventCategoryLabels,
  type EventCategory,
} from "@/lib/types/activities";

export default function NewEventPage() {
  const router = useRouter();
  const { can, role } = usePermissions();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<EventCategory>("cultural");
  const [startDate, setStartDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [venue, setVenue] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!can("activities.manageEvents"))
    return (
      <PermissionDenied
        action="create events"
        role={roleLabels[role]}
        backHref="/activities/events"
      />
    );

  const submit = () => {
    const result = createEvent({
      title,
      category,
      startDate,
      venue,
      description,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(`/activities/events/${result.eventId}`);
  };

  return (
    <div className="mx-auto flex  flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="ghost">
          <Link href="/activities/events">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-lg font-semibold text-foreground">New event</h1>
          <p className="text-xs text-muted-foreground">
            Created at the Idea stage — advance it through the Event Journey.
          </p>
        </div>
      </div>

      <div className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
        <div>
          <Label htmlFor="evt-title">Title</Label>
          <Input
            id="evt-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Annual Day Celebration"
          />
        </div>
        <div className="grid grid-cols-2 gap-sm">
          <div>
            <Label>Category</Label>
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as EventCategory)}>
              <SelectTrigger aria-label="Category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(eventCategoryLabels).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="evt-date">Start date</Label>
            <Input
              id="evt-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="evt-venue">Venue</Label>
          <Input
            id="evt-venue"
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            placeholder="e.g. Main Auditorium"
          />
        </div>
        <div>
          <Label htmlFor="evt-desc">Description</Label>
          <Textarea
            id="evt-desc"
            value={description}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
              setDescription(e.target.value)
            }
            rows={2}
            placeholder="Short description"
          />
        </div>
        {error && (
          <p className="rounded-md border border-error/30 bg-error/8 p-sm text-xs text-error">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-xs">
          <Button asChild size="sm" variant="ghost">
            <Link href="/activities/events">Cancel</Link>
          </Button>
          <Button
            size="sm"
            onClick={submit}
            disabled={!title.trim() || !startDate}>
            Create event
          </Button>
        </div>
      </div>
    </div>
  );
}
