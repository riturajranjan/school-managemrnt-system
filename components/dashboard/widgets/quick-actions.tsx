"use client";

import { Zap } from "lucide-react";
import { createActions } from "@/components/shell/nav-config";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// Mobile-only launcher — reuses the same action set as the header's quick-create
// menu (components/shell/nav-config.ts) rather than a second hardcoded list.
// Not data-fetched, so it skips the loading/error/empty machinery other
// widgets use — there's nothing asynchronous here to fail or be empty.
export function QuickActionsWidget() {
  return (
    <section className="flex h-full flex-col rounded-lg border border-border bg-surface p-md shadow-card sm:p-lg">
      <h2 className="mb-sm flex items-center gap-xs text-sm font-semibold text-foreground">
        <Zap className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        Quick Actions
      </h2>
      <div className="flex flex-wrap gap-xs" role="group" aria-label="Quick actions">
        {createActions.map(({ key, label, icon: Icon }) => (
          <Tooltip key={key}>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={label}
                className="flex size-11 shrink-0 items-center justify-center rounded-md border border-border text-foreground outline-none transition-colors hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Icon className="size-4.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </section>
  );
}
