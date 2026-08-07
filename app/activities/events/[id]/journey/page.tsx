"use client";

import Link from "next/link";
import { use, useState } from "react";
import { ArrowLeft, Check, Circle, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { setEventStage } from "@/lib/services/activities-service";
import { roleLabels } from "@/lib/permissions/roles";
import { eventJourneyOrder, eventStageLabels } from "@/lib/types/activities";
import type { EventStage } from "@/lib/types/activities";
import { formatDate } from "@/lib/utils";

const STAGE_HINT: Record<EventStage, string> = {
  idea: "Captured as a proposal awaiting review.",
  planning: "Coordinators, tasks and budget are being organised.",
  approved: "Signed off by leadership — ready to promote.",
  promotion: "Registration open; being publicised to the audience.",
  live: "Happening now — attendance is being captured.",
  completed: "Concluded; results and certificates can be finalised.",
  archived: "Closed and archived for the record.",
  cancelled: "This event was cancelled.",
};

export default function EventJourneyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [, force] = useState(0);

  const event = db.schoolEvents.find((e) => e.id === id);
  if (!can("activities.view"))
    return (
      <PermissionDenied
        action="view the event journey"
        role={roleLabels[role]}
        backHref="/activities/events"
      />
    );
  if (!event)
    return (
      <div className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">
        Event not found.{" "}
        <Link href="/activities/events" className="text-primary">
          Back
        </Link>
      </div>
    );

  const canManage = can("activities.manageEvents");
  const stageIdx = eventJourneyOrder.indexOf(event.stage);
  const cancelled = event.stage === "cancelled";

  return (
    <div className="mx-auto flex  flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="ghost">
          <Link href={`/activities/events/${id}`}>
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            Event Journey
          </h1>
          <p className="text-xs text-muted-foreground">
            {event.title} · {formatDate(event.startDate)}
          </p>
        </div>
      </div>

      {cancelled && (
        <div className="flex items-center gap-2 rounded-md border border-error/30 bg-error/8 p-sm text-sm text-error">
          <X className="size-4" /> This event has been cancelled.
        </div>
      )}

      <div className="rounded-lg border border-border bg-surface p-md">
        <ol className="flex flex-col">
          {eventJourneyOrder.map((s, i) => {
            const done = !cancelled && i < stageIdx;
            const current = !cancelled && i === stageIdx;
            return (
              <li key={s} className="flex gap-sm pb-md last:pb-0">
                <div className="flex flex-col items-center">
                  <span
                    className={`flex size-8 shrink-0 items-center justify-center rounded-full border-2 ${done ? "border-success bg-success/15 text-success" : current ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}>
                    {done ? (
                      <Check className="size-4" />
                    ) : (
                      <Circle className="size-3" />
                    )}
                  </span>
                  {i < eventJourneyOrder.length - 1 && (
                    <span
                      className={`w-0.5 flex-1 ${done ? "bg-success/40" : "bg-border"}`}
                    />
                  )}
                </div>
                <div className="flex-1 pt-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">
                      {eventStageLabels[s]}
                    </p>
                    {current && <Badge tone="info">Current</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {STAGE_HINT[s]}
                  </p>
                  {canManage && !cancelled && i !== stageIdx && (
                    <button
                      type="button"
                      onClick={() => {
                        setEventStage(id, s);
                        force((n) => n + 1);
                      }}
                      className="mt-1 text-xs font-medium text-primary hover:underline">
                      Set to this stage
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
