"use client";

import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getBreadcrumb } from "./nav-config";

export function Breadcrumb() {
  const pathname = usePathname();
  const { groupLabel, pageLabel } = getBreadcrumb(pathname);

  return (
    <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
      <ol className="flex min-w-0 items-center gap-xs text-sm">
        {groupLabel && (
          <>
            <li className="shrink-0 truncate text-muted-foreground">{groupLabel}</li>
            <li aria-hidden="true" className="shrink-0 text-muted-foreground/40">
              <ChevronRight className="size-3.5" />
            </li>
          </>
        )}
        <li className="truncate font-semibold text-foreground" aria-current="page">
          {pageLabel}
        </li>
      </ol>
    </nav>
  );
}
