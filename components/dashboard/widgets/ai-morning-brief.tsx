"use client";

import {
  Bus,
  Check,
  CheckCircle2,
  FileBadge,
  HelpCircle,
  MoreHorizontal,
  RefreshCw,
  Sparkles,
  UserPlus,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AiInsightCategory, PriorityLevel } from "../data/types";
import { fetchAiBrief } from "../data/mock-data";
import { DetailDrawer } from "../detail-drawer";
import { toneClasses } from "../tone";
import { useWidgetData } from "../use-widget-data";
import { WidgetShell, widgetActionButtonClass } from "../widget-shell";

const CATEGORY_ICON: Record<AiInsightCategory, LucideIcon> = {
  staff: Users,
  attendance: CheckCircle2,
  fees: Wallet,
  transport: Bus,
  admissions: UserPlus,
  academics: FileBadge,
};

const PRIORITY_TONE: Record<PriorityLevel, keyof typeof toneClasses> = {
  high: "error",
  medium: "warning",
  low: "info",
};

export function AiMorningBriefWidget() {
  const state = useWidgetData(fetchAiBrief);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [explainingId, setExplainingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const insights = state.status === "ready" ? state.data.insights.filter((i) => !dismissedIds.has(i.id)) : [];
  const selected = insights.find((i) => i.id === selectedId) ?? null;

  function dismiss(id: string) {
    setDismissedIds((prev) => new Set(prev).add(id));
    if (selectedId === id) setSelectedId(null);
    if (explainingId === id) setExplainingId(null);
  }

  function markComplete(id: string) {
    setCompletedIds((prev) => new Set(prev).add(id));
    if (selectedId === id) setSelectedId(null);
  }

  return (
    <>
      <WidgetShell
        title="AI Morning Brief"
        icon={Sparkles}
        status={state.status}
        error={state.status === "error" ? state.error : undefined}
        onRetry={state.retry}
        isEmpty={state.status === "ready" && insights.length === 0}
        emptyMessage="No operational insights right now — you're all caught up."
        emptyIcon={CheckCircle2}
        action={
          state.status === "ready" ? (
            <button
              type="button"
              onClick={state.retry}
              className={widgetActionButtonClass}
            >
              <RefreshCw className="size-3.5" aria-hidden="true" />
              Regenerate
            </button>
          ) : undefined
        }
      >
        <div className="flex h-full flex-col gap-0.5">
          {insights.map((insight) => {
            const Icon = CATEGORY_ICON[insight.category];
            const isComplete = completedIds.has(insight.id);
            const isExplaining = explainingId === insight.id;

            return (
              <div key={insight.id} className="rounded-md">
                <div className="flex w-full items-start gap-sm rounded-md px-xs py-1 transition-colors hover:bg-surface-secondary">
                  <button
                    type="button"
                    onClick={() => setSelectedId(insight.id)}
                    className="flex min-w-0 flex-1 items-start gap-sm rounded-md py-0.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-xs">
                        {isComplete ? (
                          <span className="rounded-pill bg-success/15 px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-success">
                            Done
                          </span>
                        ) : (
                          <span
                            className={`rounded-pill px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${toneClasses[PRIORITY_TONE[insight.priority]].soft}`}
                          >
                            {insight.priority}
                          </span>
                        )}
                        <span
                          className={`text-sm ${isComplete ? "text-muted-foreground line-through" : "text-foreground"}`}
                        >
                          {insight.title}
                        </span>
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-xs text-xs text-muted-foreground">
                        <span>{insight.timeContext}</span>
                        <span aria-hidden="true">·</span>
                        <span className="truncate">{insight.recommendedAction}</span>
                      </span>
                    </span>
                  </button>

                  <DropdownMenu>
                    <DropdownMenuTrigger
                      aria-label={`More actions for ${insight.title}`}
                      className="flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors active:scale-[0.97] hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-ring sm:size-7"
                    >
                      <MoreHorizontal className="size-4" aria-hidden="true" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setExplainingId(isExplaining ? null : insight.id)}>
                        <HelpCircle className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <span>Explain insight</span>
                      </DropdownMenuItem>
                      {!isComplete && (
                        <DropdownMenuItem onSelect={() => markComplete(insight.id)}>
                          <Check className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                          <span>Mark complete</span>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onSelect={() => dismiss(insight.id)}>
                        <X className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <span>Dismiss</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {isExplaining && (
                  <div className="ml-md mt-0.5 flex items-start gap-xs rounded-md bg-surface-secondary px-sm py-xs">
                    <HelpCircle className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
                    <p className="flex-1 text-xs text-muted-foreground">{insight.explanation}</p>
                    <button
                      type="button"
                      onClick={() => setExplainingId(null)}
                      aria-label="Close explanation"
                      className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors active:scale-[0.97] hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-ring sm:size-6"
                    >
                      <X className="size-3.5" aria-hidden="true" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </WidgetShell>

      <DetailDrawer
        open={selected !== null}
        onOpenChange={(open) => !open && setSelectedId(null)}
        title={selected?.title ?? "Insight"}
        footer={
          selected && (
            <div className="flex gap-sm">
              <button
                type="button"
                onClick={() => markComplete(selected.id)}
                className="min-h-11 flex-1 rounded-md bg-primary px-sm text-sm font-medium text-primary-foreground outline-none transition-colors active:scale-[0.97] hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
              >
                Mark complete
              </button>
              <button
                type="button"
                onClick={() => dismiss(selected.id)}
                className="min-h-11 flex-1 rounded-md border border-border px-sm text-sm font-medium text-foreground outline-none transition-colors active:scale-[0.97] hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-ring"
              >
                Dismiss
              </button>
            </div>
          )
        }
      >
        {selected && (
          <div className="flex flex-col gap-md">
            <span
              className={`w-fit rounded-pill px-sm py-0.5 text-xs font-semibold uppercase tracking-wide ${toneClasses[PRIORITY_TONE[selected.priority]].soft}`}
            >
              {selected.priority} priority
            </span>
            <dl className="flex flex-col gap-xs text-sm">
              <div className="flex justify-between border-b border-border py-xs">
                <dt className="text-muted-foreground">When</dt>
                <dd className="text-foreground">{selected.timeContext}</dd>
              </div>
              <div className="flex justify-between border-b border-border py-xs">
                <dt className="text-muted-foreground">Category</dt>
                <dd className="capitalize text-foreground">{selected.category}</dd>
              </div>
            </dl>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Recommended action
              </p>
              <p className="text-sm text-foreground">{selected.recommendedAction}</p>
            </div>
            <div>
              <p className="mb-1 flex items-center gap-xs text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <HelpCircle className="size-3.5" aria-hidden="true" />
                Why this was flagged
              </p>
              <p className="text-sm text-muted-foreground">{selected.explanation}</p>
            </div>
          </div>
        )}
      </DetailDrawer>
    </>
  );
}
