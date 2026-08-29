"use client";

// Real PostgreSQL/API cutover (Production migration, Phase A) — reads GET
// /api/library/copies. LibraryBookCopy.shelfLocation is a plain optional text
// field (no normalized Shelf/capacity model exists — see the doc comment on
// lib/server/library/copies.ts), so this is an honest aggregate view grouped
// by that real field: real copy counts and statuses, no fabricated capacity,
// occupancy percentage, zone/floor/rack hierarchy, or per-shelf stocktake
// status (stocktake isn't implemented yet). A small UX simplification from
// the old mock design, required because the real data model doesn't carry
// that information.
import { Library } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useLibraryCopies } from "@/lib/hooks/api/use-library-api";
import type { LibraryBookCopyDto, LibraryCopyStatusDto } from "@/lib/api/contracts";
import { roleLabels } from "@/lib/permissions/roles";

const UNASSIGNED = "Unassigned";
const statusTone: Record<LibraryCopyStatusDto, "success" | "warning" | "error" | "neutral"> = {
  available: "success",
  issued: "neutral",
  damaged: "warning",
  lost: "error",
  archived: "neutral",
};

function groupByShelf(copies: LibraryBookCopyDto[]) {
  const groups = new Map<string, LibraryBookCopyDto[]>();
  for (const c of copies) {
    const key = c.shelfLocation?.trim() || UNASSIGNED;
    const list = groups.get(key) ?? [];
    list.push(c);
    groups.set(key, list);
  }
  return [...groups.entries()].sort(([a], [b]) => (a === UNASSIGNED ? 1 : b === UNASSIGNED ? -1 : a.localeCompare(b)));
}

export default function ShelvesPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: copies, loading, error } = useLibraryCopies();

  if (!capabilitiesLoading && !hasServerPermission("library.view")) return <PermissionDenied action="view shelves" role={roleLabels[role]} backHref="/library" />;

  const shelves = groupByShelf(copies.filter((c) => c.status !== "archived"));

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Shelves</h1>
        <p className="text-xs text-muted-foreground">Book copies grouped by their recorded shelf location</p>
      </div>

      {error && <p className="rounded-md border border-error/30 bg-error/8 p-sm text-sm text-error">{error}</p>}
      {loading && copies.length === 0 && <p className="text-xs text-muted-foreground">Loading…</p>}

      {!loading && shelves.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-surface-secondary text-muted-foreground">
            <Library className="size-5" />
          </span>
          <p className="text-sm text-muted-foreground">No book copies yet — add copies from the Books catalogue to see them grouped by shelf here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-sm sm:grid-cols-2 lg:grid-cols-3">
          {shelves.map(([shelf, items]) => {
            const counts = items.reduce<Partial<Record<LibraryCopyStatusDto, number>>>((acc, c) => ({ ...acc, [c.status]: (acc[c.status] ?? 0) + 1 }), {});
            return (
              <div key={shelf} className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
                <div className="flex items-start justify-between gap-sm">
                  <p className="truncate text-sm font-semibold text-foreground">{shelf}</p>
                  <Badge tone="neutral">{items.length} cop{items.length === 1 ? "y" : "ies"}</Badge>
                </div>
                <div className="flex flex-wrap gap-xs">
                  {(Object.keys(counts) as LibraryCopyStatusDto[]).map((status) => (
                    <Badge key={status} tone={statusTone[status]}>
                      {counts[status]} {status}
                    </Badge>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
