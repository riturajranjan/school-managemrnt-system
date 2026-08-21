"use client";

// Real PostgreSQL/API cutover (Phase 9L) — derived, personalized action items
// aggregated live from existing real domains (Lesson Plans, Leave, Marks,
// Fees, Payroll, Visitors, Communication). No ActionItem table, no second
// workflow — see lib/server/action-inbox/service.ts.
import Link from "next/link";
import { AlertTriangle, ArrowRight, Inbox } from "lucide-react";
import { useActionInbox } from "@/lib/hooks/api/use-action-inbox-api";
import { WidgetShell, widgetActionButtonClass } from "../widget-shell";

export function ActionInboxWidget() {
  const { data: items, loading, error } = useActionInbox();
  const status = loading ? "loading" : error ? "error" : "ready";
  const top = items.slice(0, 5);

  return (
    <WidgetShell
      title="Action Inbox"
      icon={Inbox}
      status={status}
      error={error ? new Error(error) : undefined}
      isEmpty={status === "ready" && items.length === 0}
      emptyMessage="All caught up — nothing needs your attention right now."
      action={
        status === "ready" && items.length > 0 ? (
          <Link href="/action-inbox" className={widgetActionButtonClass}>
            <ArrowRight className="size-3.5" aria-hidden="true" />
            View all ({items.length})
          </Link>
        ) : undefined
      }
    >
      {status === "ready" && items.length > 0 && (
        <ul className="flex flex-col gap-1">
          {top.map((item) => (
            <li key={item.id}>
              <Link href={item.href} className="flex items-center gap-2 rounded-md px-1 py-1 text-sm hover:bg-surface-secondary/60">
                {(item.priority === "urgent" || item.priority === "high") && <AlertTriangle className="size-3.5 shrink-0 text-warning" aria-hidden="true" />}
                <span className="truncate text-foreground">{item.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  );
}
