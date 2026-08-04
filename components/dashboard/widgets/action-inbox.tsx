"use client";

import {
  Award,
  Check,
  FileBadge,
  Inbox,
  ShoppingCart,
  UserPlus,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import type { ActionCategory, ActionInboxItem, PriorityLevel } from "../data/types";
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

const CATEGORY_LABEL: Record<ActionCategory, string> = {
  leave: "Leave request",
  admission: "Admission approval",
  "fee-concession": "Fee concession",
  certificate: "Certificate",
  "result-publication": "Result publication",
  purchase: "Purchase approval",
};

const CATEGORY_ICON: Record<ActionCategory, LucideIcon> = {
  leave: Check,
  admission: UserPlus,
  "fee-concession": Wallet,
  certificate: FileBadge,
  "result-publication": Award,
  purchase: ShoppingCart,
};

type ResolutionMap = Record<string, "approved" | "rejected">;

export function ActionInboxWidget() {
  const state = useWidgetData(fetchActionInbox);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [resolutions, setResolutions] = useState<ResolutionMap>({});

  const items = state.status === "ready" ? state.data.items.filter((item) => !resolutions[item.id]) : [];
  const selected = items.find((item) => item.id === selectedId) ?? null;

  function resolve(id: string, outcome: "approved" | "rejected") {
    setResolutions((prev) => ({ ...prev, [id]: outcome }));
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
        <ul className="flex h-full flex-col gap-0.5 overflow-y-auto">
          {items.slice(0, 6).map((item) => {
            const CategoryIcon = CATEGORY_ICON[item.category];
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className="flex w-full min-h-11 items-start gap-sm rounded-md px-xs py-1 text-left outline-none transition-colors hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <CategoryIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-xs">
                      <span
                        className={`shrink-0 rounded-pill px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${toneClasses[PRIORITY_TONE[item.priority]].soft}`}
                      >
                        {item.priority}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-foreground">{item.title}</span>
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{item.dueLabel}</span>
                  </span>
                </button>
              </li>
            );
          })}
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
                onClick={() => resolve(selected.id, "approved")}
                className="flex min-h-11 flex-1 items-center justify-center gap-xs rounded-md bg-primary px-sm text-sm font-medium text-primary-foreground outline-none transition-colors active:scale-[0.97] hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Check className="size-4 shrink-0" aria-hidden="true" />
                Approve
              </button>
              <button
                type="button"
                onClick={() => resolve(selected.id, "rejected")}
                className="flex min-h-11 flex-1 items-center justify-center gap-xs rounded-md border border-border px-sm text-sm font-medium text-error outline-none transition-colors active:scale-[0.97] hover:bg-error/10 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-4 shrink-0" aria-hidden="true" />
                Reject
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
  const CategoryIcon = CATEGORY_ICON[item.category];
  return (
    <div className="flex flex-col gap-md">
      <div className="flex items-center gap-xs">
        <span
          className={`rounded-pill px-sm py-0.5 text-xs font-semibold uppercase tracking-wide ${toneClasses[PRIORITY_TONE[item.priority]].soft}`}
        >
          {item.priority} priority
        </span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <CategoryIcon className="size-3.5 shrink-0" aria-hidden="true" />
          {CATEGORY_LABEL[item.category]}
        </span>
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
