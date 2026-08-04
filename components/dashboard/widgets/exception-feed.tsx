"use client";

import {
  AlertTriangle,
  Boxes,
  Bus,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileWarning,
  UserX,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import type { ExceptionCategory, ExceptionSeverity } from "../data/types";
import { fetchExceptionFeed } from "../data/mock-data";
import { DetailDrawer } from "../detail-drawer";
import { toneClasses } from "../tone";
import { useWidgetData } from "../use-widget-data";
import { WidgetShell } from "../widget-shell";

const SEVERITY_TONE: Record<ExceptionSeverity, keyof typeof toneClasses> = {
  critical: "error",
  warning: "warning",
  info: "info",
};

const CATEGORY_ICON: Record<ExceptionCategory, LucideIcon> = {
  attendance: UserX,
  fees: Wallet,
  documents: FileWarning,
  timetable: CalendarClock,
  transport: Bus,
  inventory: Boxes,
  results: ClipboardList,
};

const CATEGORY_LABEL: Record<ExceptionCategory, string> = {
  attendance: "Attendance",
  fees: "Fees",
  documents: "Documents",
  timetable: "Timetable",
  transport: "Transport",
  inventory: "Inventory",
  results: "Results",
};

export function ExceptionFeedWidget() {
  const state = useWidgetData(fetchExceptionFeed);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const items = state.status === "ready" ? state.data.items : [];
  const selected = items.find((item) => item.id === selectedId) ?? null;
  const SelectedCategoryIcon = selected ? CATEGORY_ICON[selected.category] : null;

  return (
    <>
      <WidgetShell
        title="Exception Feed"
        icon={AlertTriangle}
        status={state.status}
        error={state.status === "error" ? state.error : undefined}
        onRetry={state.retry}
        isEmpty={state.status === "ready" && items.length === 0}
        emptyMessage="No exceptions — everything is running normally."
        emptyIcon={CheckCircle2}
      >
        <ul className="flex h-full flex-col gap-0.5 overflow-y-auto">
          {items.slice(0, 5).map((item) => {
            const CategoryIcon = CATEGORY_ICON[item.category];
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className="flex w-full min-h-11 items-start gap-sm rounded-md px-xs py-1 text-left outline-none transition-colors hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span
                    className={`mt-1.5 size-1.5 shrink-0 rounded-full ${toneClasses[SEVERITY_TONE[item.severity]].dot}`}
                    aria-hidden="true"
                  />
                  <CategoryIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-foreground">{item.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {item.source} · {item.time}
                    </span>
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
        title={selected?.title ?? "Exception"}
      >
        {selected && (
          <div className="flex flex-col gap-md">
            <div className="flex flex-wrap items-center gap-xs">
              <span
                className={`w-fit rounded-pill px-sm py-0.5 text-xs font-semibold uppercase tracking-wide ${toneClasses[SEVERITY_TONE[selected.severity]].soft}`}
              >
                {selected.severity}
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                {SelectedCategoryIcon && <SelectedCategoryIcon className="size-3.5 shrink-0" aria-hidden="true" />}
                {CATEGORY_LABEL[selected.category]}
              </span>
            </div>
            <p className="text-sm text-foreground">{selected.description}</p>
            <dl className="flex flex-col gap-xs text-sm">
              <div className="flex justify-between border-b border-border py-xs">
                <dt className="text-muted-foreground">Source</dt>
                <dd className="text-foreground">{selected.source}</dd>
              </div>
              <div className="flex justify-between border-b border-border py-xs">
                <dt className="text-muted-foreground">Reported</dt>
                <dd className="text-foreground">{selected.time}</dd>
              </div>
            </dl>
          </div>
        )}
      </DetailDrawer>
    </>
  );
}
