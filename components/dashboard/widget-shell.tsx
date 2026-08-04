"use client";

import { AlertTriangle, Inbox, RefreshCw, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

// Shared header/footer action button: a real 44px tap target on touch
// viewports (below sm), collapsing to the compact desktop size at sm+ where
// pointer precision doesn't need it. active:scale gives the "subtle press"
// feedback the mobile interaction spec calls for, without any hover reliance.
export const widgetActionButtonClass =
  "flex min-h-11 items-center gap-xs rounded-md px-sm text-xs font-medium text-primary outline-none transition-colors active:scale-[0.97] hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-ring sm:min-h-0 sm:py-1";

export function WidgetShell({
  title,
  icon: Icon,
  action,
  className = "",
  bodyClassName = "",
  status,
  error,
  onRetry,
  isEmpty,
  emptyMessage = "Nothing to show right now.",
  emptyIcon: EmptyIcon = Inbox,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  action?: ReactNode;
  className?: string;
  bodyClassName?: string;
  status: "loading" | "error" | "ready";
  error?: Error;
  onRetry?: () => void;
  isEmpty?: boolean;
  emptyMessage?: string;
  emptyIcon?: LucideIcon;
  children: ReactNode;
}) {
  return (
    <section
      tabIndex={-1}
      className={`group flex h-full flex-col rounded-lg border border-border bg-surface p-md shadow-card outline-none transition-shadow hover:shadow-floating focus-within:ring-2 focus-within:ring-ring sm:p-lg ${className}`}
    >
      <header className="mb-sm flex shrink-0 items-center justify-between gap-sm">
        <h2 className="flex min-w-0 items-center gap-xs text-sm font-semibold text-foreground">
          {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
          <span className="truncate">{title}</span>
        </h2>
        {status === "ready" && !isEmpty && action}
      </header>

      <div className={`min-h-0 flex-1 ${bodyClassName}`}>
        {status === "loading" ? (
          <WidgetSkeleton />
        ) : status === "error" ? (
          <WidgetError message={error?.message} onRetry={onRetry} />
        ) : isEmpty ? (
          <WidgetEmpty message={emptyMessage} icon={EmptyIcon} />
        ) : (
          children
        )}
      </div>
    </section>
  );
}

function WidgetSkeleton() {
  return (
    <div className="flex h-full flex-col justify-center gap-xs" role="status" aria-label="Loading">
      <div className="skeleton h-4 w-3/4 rounded-sm" />
      <div className="skeleton h-4 w-1/2 rounded-sm" />
      <div className="skeleton h-4 w-5/6 rounded-sm" />
    </div>
  );
}

function WidgetError({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-xs py-md text-center" role="alert">
      <AlertTriangle className="size-5 text-error" aria-hidden="true" />
      <p className="text-sm font-medium text-foreground">Couldn&apos;t load this widget</p>
      {message && <p className="max-w-xs text-xs text-muted-foreground">{message}</p>}
      {onRetry && (
        <button type="button" onClick={onRetry} className={`mt-xs ${widgetActionButtonClass}`}>
          <RefreshCw className="size-3.5" aria-hidden="true" />
          Retry
        </button>
      )}
    </div>
  );
}

function WidgetEmpty({ message, icon: Icon }: { message: string; icon: LucideIcon }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-xs py-md text-center">
      <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
      <p className="max-w-xs text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
