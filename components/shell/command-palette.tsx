"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { searchCategories, searchRecords, type SearchCategoryKey } from "./search-data";
import { useShell } from "./shell-context";
import { mobileIconButtonClass } from "./styles";

export function CommandPaletteTrigger({ variant = "header" }: { variant?: "header" | "mobile" }) {
  const { setCommandPaletteOpen } = useShell();

  if (variant === "mobile") {
    return (
      <button
        type="button"
        onClick={() => setCommandPaletteOpen(true)}
        className={mobileIconButtonClass}
        aria-label="Search"
      >
        <Search className="size-4" aria-hidden="true" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setCommandPaletteOpen(true)}
      className="flex min-h-9 w-40 items-center gap-sm rounded-pill border border-border bg-surface px-md py-xs text-sm text-muted-foreground outline-none transition-colors hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-ring xl:w-64"
    >
      <Search className="size-4 shrink-0" aria-hidden="true" />
      <span className="hidden flex-1 text-left xl:inline">Search…</span>
      <kbd className="ml-auto hidden shrink-0 rounded-sm border border-border bg-surface-secondary px-1.5 py-0.5 text-xs font-medium text-muted-foreground sm:inline">
        ⌘K
      </kbd>
    </button>
  );
}

export function CommandPaletteDialog() {
  const { commandPaletteOpen, setCommandPaletteOpen } = useShell();
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<SearchCategoryKey | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const reduceMotion = useReducedMotion();
  const router = useRouter();

  const normalizedQuery = query.trim().toLowerCase();

  const filteredRecords = useMemo(() => {
    if (normalizedQuery) {
      return searchRecords.filter(
        (record) =>
          record.title.toLowerCase().includes(normalizedQuery) ||
          record.subtitle.toLowerCase().includes(normalizedQuery),
      );
    }
    if (selectedCategory) {
      return searchRecords.filter((record) => record.category === selectedCategory);
    }
    return [];
  }, [normalizedQuery, selectedCategory]);

  const groupedResults = useMemo(
    () =>
      searchCategories
        .map((category) => ({
          category,
          records: filteredRecords.filter((record) => record.category === category.key),
        }))
        .filter((group) => group.records.length > 0),
    [filteredRecords],
  );

  const flatResults = useMemo(() => groupedResults.flatMap((group) => group.records), [groupedResults]);
  const activeIndex = Math.min(highlightedIndex, Math.max(flatResults.length - 1, 0));
  const activeId = flatResults.length > 0 ? `search-option-${activeIndex}` : undefined;

  function close() {
    setCommandPaletteOpen(false);
    setQuery("");
    setSelectedCategory(null);
    setHighlightedIndex(0);
  }

  function go(href: string) {
    router.push(href);
    close();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((index) => Math.min(index + 1, flatResults.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      const record = flatResults[activeIndex];
      if (record) {
        event.preventDefault();
        go(record.href);
      }
    }
  }

  const showChips = !normalizedQuery && !selectedCategory;
  const activeCategoryMeta = selectedCategory ? searchCategories.find((c) => c.key === selectedCategory) : null;

  return (
    <Dialog.Root
      open={commandPaletteOpen}
      onOpenChange={(open) => {
        if (open) setCommandPaletteOpen(true);
        else close();
      }}
    >
      <AnimatePresence>
        {commandPaletteOpen && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                className="fixed inset-0 z-50 bg-black/40"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.15 }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount>
              <motion.div
                className="glass fixed inset-x-0 top-24 z-50 mx-auto w-[calc(100%_-_2rem)] max-w-[32rem] overflow-hidden rounded-lg shadow-floating"
                initial={{ opacity: 0, scale: 0.97, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: -8 }}
                transition={{ duration: reduceMotion ? 0 : 0.15, ease: "easeOut" }}
              >
                <Dialog.Title className="sr-only">Global search</Dialog.Title>
                <Dialog.Description className="sr-only">
                  Search students, parents, teachers, staff, classes, invoices, receipts, exams, documents,
                  transport routes, and library books.
                </Dialog.Description>

                <div className="flex items-center gap-sm border-b border-border px-md py-sm">
                  <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <input
                    autoFocus
                    role="combobox"
                    aria-expanded={flatResults.length > 0}
                    aria-controls="search-listbox"
                    aria-activedescendant={activeId}
                    aria-label="Search students, parents, teachers, staff, classes, invoices, receipts, exams, documents, transport routes, and library books"
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setHighlightedIndex(0);
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Search students, staff, classes, invoices…"
                    className="min-h-11 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  />
                  <kbd className="hidden shrink-0 rounded-sm border border-border bg-surface-secondary px-1.5 py-0.5 text-xs text-muted-foreground sm:inline">
                    Esc
                  </kbd>
                </div>

                {activeCategoryMeta && !normalizedQuery && (
                  <div className="flex items-center gap-xs border-b border-border px-md py-xs">
                    <span className="flex items-center gap-xs rounded-pill bg-surface-secondary px-sm py-1 text-xs font-medium text-foreground">
                      <activeCategoryMeta.icon className="size-3.5" aria-hidden="true" />
                      {activeCategoryMeta.label}
                      <button
                        type="button"
                        onClick={() => setSelectedCategory(null)}
                        aria-label={`Clear ${activeCategoryMeta.label} filter`}
                        className="ml-1 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <X className="size-3.5" aria-hidden="true" />
                      </button>
                    </span>
                  </div>
                )}

                {showChips ? (
                  <div className="grid grid-cols-2 gap-xs p-sm sm:grid-cols-3">
                    {searchCategories.map((category) => (
                      <button
                        key={category.key}
                        type="button"
                        onClick={() => setSelectedCategory(category.key)}
                        className="flex min-h-11 items-center gap-sm rounded-md px-sm text-sm text-foreground outline-none transition-colors hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <category.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <span className="truncate">{category.label}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div id="search-listbox" role="listbox" aria-label="Search results" className="max-h-80 overflow-y-auto p-sm">
                    {groupedResults.map((group) => (
                      <div key={group.category.key}>
                        <p className="px-sm pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {group.category.label}
                        </p>
                        {group.records.map((record) => {
                          const index = flatResults.indexOf(record);
                          const active = index === activeIndex;
                          return (
                            <Link
                              key={record.id}
                              id={`search-option-${index}`}
                              role="option"
                              aria-selected={active}
                              href={record.href}
                              onClick={close}
                              onMouseEnter={() => setHighlightedIndex(index)}
                              className={`flex min-h-11 items-center gap-sm rounded-md px-sm text-sm outline-none ${
                                active ? "bg-surface-secondary" : ""
                              }`}
                            >
                              <group.category.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                              <span className="flex-1 truncate text-foreground">{record.title}</span>
                              <span className="shrink-0 truncate text-xs text-muted-foreground">{record.subtitle}</span>
                            </Link>
                          );
                        })}
                      </div>
                    ))}
                    {normalizedQuery && flatResults.length === 0 && (
                      <p className="px-sm py-lg text-center text-sm text-muted-foreground">
                        No results for &ldquo;{query}&rdquo;.
                      </p>
                    )}
                  </div>
                )}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
