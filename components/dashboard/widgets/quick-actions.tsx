"use client";

import { Zap } from "lucide-react";
import { createActions } from "@/components/shell/nav-config";

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
      <div className="grid grid-cols-2 gap-xs">
        {createActions.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            className="flex min-h-11 items-center gap-xs rounded-md border border-border px-sm text-left text-xs font-medium text-foreground outline-none transition-colors hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="truncate">{label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
