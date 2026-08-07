"use client";

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Inbox,
  MoreHorizontal,
  SearchX,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ColumnDef, RowAction } from "./types";

type SortState = { columnId: string; direction: "asc" | "desc" } | null;

export function DataTable<T>({
  columns,
  rows,
  getRowId,
  renderMobileCard,
  onRowClick,
  selectable = false,
  selectedIds,
  onSelectionChange,
  rowActions,
  pageSize = 10,
  emptyIcon: EmptyIcon = Inbox,
  emptyTitle = "No records found",
  emptyDescription = "Try adjusting your filters or search.",
  isFiltered = false,
  caption,
  bulkActionBar,
}: {
  columns: ColumnDef<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  renderMobileCard: (row: T) => ReactNode;
  onRowClick?: (row: T) => void;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  rowActions?: RowAction<T>[];
  pageSize?: number;
  emptyIcon?: typeof Inbox;
  emptyTitle?: string;
  emptyDescription?: string;
  isFiltered?: boolean;
  caption: string;
  bulkActionBar?: ReactNode;
}) {
  const [sort, setSort] = useState<SortState>(null);
  const [page, setPage] = useState(1);
  const [visibleIds, setVisibleIds] = useState<Set<string>>(
    () =>
      new Set(
        columns.filter((c) => c.defaultVisible !== false).map((c) => c.id),
      ),
  );

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((c) => c.id === sort.columnId);
    if (!column?.sortValue) return rows;
    const factor = sort.direction === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = column.sortValue!(a);
      const bv = column.sortValue!(b);
      if (av < bv) return -1 * factor;
      if (av > bv) return 1 * factor;
      return 0;
    });
  }, [rows, sort, columns]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const visibleColumns = columns.filter(
    (c) => c.alwaysVisible || visibleIds.has(c.id),
  );
  const allOnPageSelected =
    selectable &&
    pageRows.length > 0 &&
    pageRows.every((r) => selectedIds?.has(getRowId(r)));

  function toggleSort(columnId: string) {
    setSort((current) => {
      if (current?.columnId !== columnId) return { columnId, direction: "asc" };
      if (current.direction === "asc") return { columnId, direction: "desc" };
      return null;
    });
  }

  function toggleRowSelection(id: string) {
    if (!onSelectionChange || !selectedIds) return;
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  }

  function togglePageSelection() {
    if (!onSelectionChange || !selectedIds) return;
    const next = new Set(selectedIds);
    if (allOnPageSelected) {
      pageRows.forEach((r) => next.delete(getRowId(r)));
    } else {
      pageRows.forEach((r) => next.add(getRowId(r)));
    }
    onSelectionChange(next);
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
        {isFiltered ? (
          <SearchX
            className="size-6 text-muted-foreground"
            aria-hidden="true"
          />
        ) : (
          <EmptyIcon
            className="size-6 text-muted-foreground"
            aria-hidden="true"
          />
        )}
        <p className="text-sm font-medium text-foreground">
          {isFiltered ? "No results match your filters" : emptyTitle}
        </p>
        {/*  (384px), not the old max-w-xs (320px) — narrow enough to stay
            readable as a centered paragraph, wide enough that a normal one-sentence
            description doesn't wrap into a cramped 3-4 line column. */}
        <p className=" text-xs text-muted-foreground">
          {isFiltered
            ? "Clear filters or try a different search term."
            : emptyDescription}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-sm">
      {selectable && selectedIds && selectedIds.size > 0 && bulkActionBar}

      {/* Desktop / tablet table */}
      <div className="hidden overflow-x-auto rounded-lg border border-border bg-surface md:block">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-border bg-surface-secondary/60 text-left">
              {selectable && (
                <th className="w-10 px-sm py-sm">
                  <Checkbox
                    checked={allOnPageSelected}
                    onCheckedChange={togglePageSelection}
                    aria-label="Select all rows on this page"
                  />
                </th>
              )}
              {visibleColumns.map((column) => (
                <th
                  key={column.id}
                  scope="col"
                  style={{ width: column.width }}
                  className={cn(
                    "whitespace-nowrap px-sm py-sm text-xs font-semibold text-muted-foreground",
                    column.align === "right" && "text-right",
                  )}>
                  {column.sortValue ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(column.id)}
                      className="inline-flex items-center gap-1 outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
                      {column.header}
                      {sort?.columnId === column.id ? (
                        sort.direction === "asc" ? (
                          <ArrowUp className="size-3" />
                        ) : (
                          <ArrowDown className="size-3" />
                        )
                      ) : (
                        <ArrowUpDown className="size-3 opacity-40" />
                      )}
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              ))}
              {rowActions && rowActions.length > 0 && (
                <th className="w-10 px-sm py-sm">
                  <span className="sr-only">Row actions</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label="Column visibility">
                        <Columns3 className="size-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Columns</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {columns
                        .filter((c) => !c.alwaysVisible)
                        .map((column) => (
                          <DropdownMenuItem
                            key={column.id}
                            onSelect={(e) => {
                              e.preventDefault();
                              setVisibleIds((current) => {
                                const next = new Set(current);
                                if (next.has(column.id)) next.delete(column.id);
                                else next.add(column.id);
                                return next;
                              });
                            }}>
                            <Checkbox
                              checked={visibleIds.has(column.id)}
                              className="pointer-events-none"
                            />
                            {column.header}
                          </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => {
              const id = getRowId(row);
              const selected = selectedIds?.has(id);
              return (
                <tr
                  key={id}
                  onClick={() => onRowClick?.(row)}
                  className={cn(
                    "border-b border-border last:border-0 transition-colors",
                    onRowClick &&
                      "cursor-pointer hover:bg-surface-secondary/60",
                    selected && "bg-accent/10",
                  )}>
                  {selectable && (
                    <td
                      className="px-sm py-sm"
                      onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selected}
                        onCheckedChange={() => toggleRowSelection(id)}
                        aria-label="Select row"
                      />
                    </td>
                  )}
                  {visibleColumns.map((column) => (
                    <td
                      key={column.id}
                      className={cn(
                        "px-sm py-sm align-middle",
                        column.align === "right" && "text-right",
                      )}>
                      {column.cell(row)}
                    </td>
                  ))}
                  {rowActions && rowActions.length > 0 && (
                    <td
                      className="px-sm py-sm text-right"
                      onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="flex size-8 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-ring"
                            aria-label="Row actions">
                            <MoreHorizontal className="size-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {rowActions
                            .filter((action) => !action.hidden?.(row))
                            .map((action) => (
                              <DropdownMenuItem
                                key={action.key}
                                onSelect={() => action.onSelect(row)}
                                className={
                                  action.destructive ? "text-error" : undefined
                                }>
                                {action.icon}
                                {action.label}
                              </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="flex flex-col gap-sm md:hidden">
        {pageRows.map((row) => (
          <div key={getRowId(row)}>{renderMobileCard(row)}</div>
        ))}
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-between gap-sm px-1 text-xs text-muted-foreground">
          <span>
            {(safePage - 1) * pageSize + 1}–
            {Math.min(safePage * pageSize, sorted.length)} of {sorted.length}
          </span>
          <div className="flex items-center gap-xs">
            <Button
              variant="outline"
              size="icon"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => p - 1)}
              aria-label="Previous page">
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-12 text-center font-medium text-foreground">
              {safePage} / {pageCount}
            </span>
            <Button
              variant="outline"
              size="icon"
              disabled={safePage >= pageCount}
              onClick={() => setPage((p) => p + 1)}
              aria-label="Next page">
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
