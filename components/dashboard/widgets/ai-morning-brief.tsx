"use client";

import { Sparkles } from "lucide-react";
import { fetchAiBrief } from "../data/mock-data";
import { toneClasses } from "../tone";
import { useWidgetData } from "../use-widget-data";
import { WidgetShell } from "../widget-shell";

export function AiMorningBriefWidget() {
  const state = useWidgetData(fetchAiBrief);

  return (
    <WidgetShell
      title="AI Morning Brief"
      icon={Sparkles}
      status={state.status}
      error={state.status === "error" ? state.error : undefined}
      onRetry={state.retry}
      isEmpty={state.status === "ready" && state.data.priorities.length === 0 && !state.data.summary}
      emptyMessage="No brief available yet — check back after your first data sync."
    >
      {state.status === "ready" && (
        <div className="flex h-full flex-col gap-sm">
          <div>
            <p className="text-sm text-foreground">
              Good morning, <span className="font-semibold">{state.data.greetingName}</span>.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{state.data.summary}</p>
          </div>
          {state.data.priorities.length > 0 && (
            <ul className="flex flex-col gap-xs">
              {state.data.priorities.map((priority) => (
                <li key={priority.id} className="flex items-start gap-xs text-sm">
                  <span
                    className={`mt-1.5 size-1.5 shrink-0 rounded-full ${toneClasses[priority.tone].dot}`}
                    aria-hidden="true"
                  />
                  <span className="text-foreground">{priority.label}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-auto pt-xs text-xs text-muted-foreground">Generated {state.data.generatedAt}</p>
        </div>
      )}
    </WidgetShell>
  );
}
