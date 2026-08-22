"use client";

// Action Inbox (Phase 9L) — real, PostgreSQL-derived "what needs my
// attention right now" view. Every item is computed live from an existing
// real domain's own status (Lesson Plans, Leave, Marks, Fees, Payroll,
// Visitors, Communication) — there is no ActionItem table and no second
// workflow. Resolving the item in its real source (approve leave, finalize
// payroll, verify marks, etc.) makes it disappear here on next load.
import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, Inbox } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useActionInbox, useActionInboxSummary } from "@/lib/hooks/api/use-action-inbox-api";
import { roleLabels } from "@/lib/permissions/roles";
import type { ActionCategoryDto, ActionPriorityDto } from "@/lib/api/contracts";
import { timeAgo } from "@/lib/utils";

const CATEGORY_LABELS: Record<ActionCategoryDto, string> = {
  lesson_plan: "Lesson plans", leave: "Leave", marks: "Marks", fees: "Fees",
  payroll: "Payroll", visitor: "Visitors", communication: "Messages", library: "Library", inventory: "Inventory",
};
const PRIORITY_TONE: Record<ActionPriorityDto, "error" | "warning" | "info" | "neutral"> = {
  urgent: "error", high: "warning", normal: "info", low: "neutral",
};

export default function ActionInboxPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const [category, setCategory] = useState<ActionCategoryDto | "all">("all");
  const { data: items, loading, error, reload } = useActionInbox({ category: category === "all" ? undefined : category });
  const { data: summary } = useActionInboxSummary();

  if (!capabilitiesLoading && !hasServerPermission("dashboard.view")) {
    return <PermissionDenied action="view the action inbox" role={roleLabels[role]} backHref="/" />;
  }

  const categories = summary ? (Object.keys(summary.byCategory) as ActionCategoryDto[]).filter((c) => summary.byCategory[c] > 0) : [];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Action Inbox</h1>
        <p className="text-xs text-muted-foreground">What needs your attention right now</p>
      </div>

      {summary && summary.total > 0 && (
        <section className="grid grid-cols-2 gap-sm sm:grid-cols-4">
          <div className="rounded-lg border border-border bg-surface p-sm">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-lg font-semibold text-foreground">{summary.total}</p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-sm">
            <p className="text-xs text-muted-foreground">Urgent</p>
            <p className="text-lg font-semibold text-error">{summary.byPriority.urgent}</p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-sm">
            <p className="text-xs text-muted-foreground">High</p>
            <p className="text-lg font-semibold text-warning">{summary.byPriority.high}</p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-sm">
            <p className="text-xs text-muted-foreground">Normal / low</p>
            <p className="text-lg font-semibold text-foreground">{summary.byPriority.normal + summary.byPriority.low}</p>
          </div>
        </section>
      )}

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setCategory("all")}
            className={`rounded-pill px-3 py-1 text-xs font-medium ${category === "all" ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`rounded-pill px-3 py-1 text-xs font-medium ${category === c ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}
            >
              {CATEGORY_LABELS[c]} ({summary?.byCategory[c]})
            </button>
          ))}
        </div>
      )}

      {error ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">{error}</p>
      ) : loading && items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
          <CheckCircle2 className="size-6 text-success" />
          <p className="text-sm font-medium text-foreground">All caught up</p>
          <p className="text-xs text-muted-foreground">Nothing needs your attention right now.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-sm">
          {items.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              onClick={() => setTimeout(reload, 300)}
              className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm hover:border-primary/40"
            >
              <div className="flex min-w-0 items-center gap-sm">
                {item.priority === "urgent" || item.priority === "high" ? (
                  <AlertTriangle className="size-4 shrink-0 text-warning" aria-hidden="true" />
                ) : (
                  <Inbox className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{item.description}</p>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Badge tone={PRIORITY_TONE[item.priority]}>{item.priority}</Badge>
                <span className="text-[10px] text-muted-foreground">{timeAgo(item.createdAt)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
