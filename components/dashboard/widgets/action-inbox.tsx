"use client";

import { Check, Inbox } from "lucide-react";
import { useState } from "react";
import type { ActionInboxItem, PriorityLevel } from "../data/types";
import { fetchActionInbox } from "../data/mock-data";
import { DetailDrawer } from "../detail-drawer";
import { toneClasses } from "../tone";
import { useWidgetData } from "../use-widget-data";
import { WidgetShell } from "../widget-shell";

const PRIORITY_TONE: Record<PriorityLevel, keyof typeof toneClasses> = {
  high: "error",
  medium: "warning",
  low: "neutral",
};

export function ActionInboxWidget() {
  const state = useWidgetData(fetchActionInbox);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());

  const items = state.status === "ready" ? state.data.items.filter((item) => !resolvedIds.has(item.id)) : [];
  const selected = items.find((item) => item.id === selectedId) ?? null;

  function resolve(id: string) {
    setResolvedIds((prev) => new Set(prev).add(id));
    setSelectedId(null);
  }

  return (
    <>
      <WidgetShell
        title="Action Inbox"
        icon={Inbox}
        status={state.status}
        error={state.status === "error" ? state.error : undefined}
        onRetry={state.retry}
        isEmpty={state.status === "ready" && items.length === 0}
        emptyMessage="You're all caught up — nothing needs action."
        emptyIcon={Check}
        action={
          state.status === "ready" && items.length > 0 ? (
            <span className="rounded-pill bg-error/15 px-sm py-0.5 text-xs font-semibold text-error">
              {items.length} pending
            </span>
          ) : undefined
        }
      >
        <ul className="flex h-full flex-col gap-0.5">
          {items.slice(0, 5).map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setSelectedId(item.id)}
                className="flex w-full min-h-11 items-center gap-sm rounded-md px-xs py-1 text-left outline-none transition-colors hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span
                  className={`shrink-0 rounded-pill px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${toneClasses[PRIORITY_TONE[item.priority]].soft}`}
                >
                  {item.priority}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">{item.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{item.dueLabel}</span>
              </button>
            </li>
          ))}
        </ul>
      </WidgetShell>

      <DetailDrawer
        open={selected !== null}
        onOpenChange={(open) => !open && setSelectedId(null)}
        title={selected?.title ?? "Action item"}
        footer={
          selected && (
            <div className="flex gap-sm">
              <button
                type="button"
                onClick={() => resolve(selected.id)}
                className="flex-1 rounded-md bg-primary px-sm py-xs text-sm font-medium text-primary-foreground outline-none transition-colors hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => resolve(selected.id)}
                className="flex-1 rounded-md border border-border px-sm py-xs text-sm font-medium text-foreground outline-none transition-colors hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-ring"
              >
                Dismiss
              </button>
            </div>
          )
        }
      >
        {selected && <ActionItemDetail item={selected} />}
      </DetailDrawer>
    </>
  );
}

function ActionItemDetail({ item }: { item: ActionInboxItem }) {
  return (
    <div className="flex flex-col gap-md">
      <div className="flex items-center gap-xs">
        <span
          className={`rounded-pill px-sm py-0.5 text-xs font-semibold uppercase tracking-wide ${toneClasses[PRIORITY_TONE[item.priority]].soft}`}
        >
          {item.priority} priority
        </span>
        <span className="text-xs text-muted-foreground">{item.category}</span>
      </div>
      <p className="text-sm text-foreground">{item.description}</p>
      <dl className="flex flex-col gap-xs text-sm">
        <div className="flex justify-between border-b border-border py-xs">
          <dt className="text-muted-foreground">Requested by</dt>
          <dd className="text-foreground">{item.requestedBy}</dd>
        </div>
        <div className="flex justify-between border-b border-border py-xs">
          <dt className="text-muted-foreground">Due</dt>
          <dd className="text-foreground">{item.dueLabel}</dd>
        </div>
      </dl>
    </div>
  );
}
