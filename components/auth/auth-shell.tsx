import type { ReactNode } from "react";
import { CampusVisual } from "./campus-visual";

/** Split-screen auth wrapper: dimensional campus visual on the left (lg+),
 * a compact form card on the right. On mobile the visual collapses to a small
 * branded header. Used by all login / recovery / verify / select pages. */
export function AuthShell({
  children,
  mobileTagline,
}: {
  children: ReactNode;
  mobileTagline?: string;
}) {
  return (
    <div className="grid flex-1 lg:grid-cols-2">
      <CampusVisual />
      <div className="flex flex-col items-center justify-center px-md py-xl sm:px-lg">
        {/* Mobile branded header */}
        <div className="mb-lg flex flex-col items-center gap-1 lg:hidden">
          <span className="flex size-11 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#022c43,#18b0c8)] text-lg font-bold text-white">
            N
          </span>
          <span className="text-sm font-semibold text-foreground">
            Novyra Campus OS
          </span>
          {mobileTagline && (
            <span className="text-xs text-muted-foreground">
              {mobileTagline}
            </span>
          )}
        </div>
        <div className="w-full max-w-[430px]">{children}</div>
      </div>
    </div>
  );
}

/** Centered wrapper for state pages (access denied, maintenance, etc.) — no
 * campus visual, just a focused card. */
export function AuthCenter({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-md py-xl">
      <div className="w-full ">{children}</div>
    </div>
  );
}

export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-surface/95 p-lg shadow-[0_8px_40px_rgba(2,44,67,0.12)] backdrop-blur-sm">
      {children}
    </div>
  );
}

export function AuthHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-md">
      <h1 className="text-xl font-bold text-foreground">{title}</h1>
      {subtitle && (
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      )}
    </div>
  );
}
