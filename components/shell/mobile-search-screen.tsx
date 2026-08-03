"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { searchCategories, searchRecords, type SearchCategoryKey } from "./search-data";
import { useShell } from "./shell-context";

// Full-screen takeover instead of a small centered modal — a compact popover
// doesn't work well on a narrow viewport. Combines search and the AI trigger
// as tabs of one screen, since mobile keeps only essential header icons.
export function MobileSearchScreen() {
  const { mobileSearchOpen, setMobileSearchOpen } = useShell();
  const [tab, setTab] = useState<"search" | "ai">("search");
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<SearchCategoryKey | null>(null);
  const reduceMotion = useReducedMotion();

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

  function close() {
    setMobileSearchOpen(false);
    setQuery("");
    setSelectedCategory(null);
    setTab("search");
  }

  return (
    <Dialog.Root open={mobileSearchOpen} onOpenChange={(open) => (open ? setMobileSearchOpen(true) : close())}>
      <AnimatePresence>
        {mobileSearchOpen && (
          <Dialog.Portal forceMount>
            <Dialog.Content asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 flex flex-col bg-background md:hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.15 }}
              >
                <Dialog.Title className="sr-only">Search</Dialog.Title>
                <Dialog.Description className="sr-only">
                  Search students, parents, teachers, staff, classes, invoices, receipts, exams, documents,
                  transport routes, and library books, or ask AI.
                </Dialog.Description>

                <div className="flex shrink-0 items-center gap-sm px-md pb-sm pt-[env(safe-area-inset-top)]">
                  <button
                    type="button"
                    onClick={close}
                    aria-label="Close search"
                    className="flex size-11 shrink-0 items-center justify-center rounded-pill text-muted-foreground outline-none transition-colors hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ArrowLeft className="size-5" aria-hidden="true" />
                  </button>
                  <div className="flex min-h-11 flex-1 items-center gap-sm rounded-pill border border-border bg-surface px-md">
                    {tab === "search" ? (
                      <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    ) : (
                      <Sparkles className="size-4 shrink-0 text-accent" aria-hidden="true" />
                    )}
                    <input
                      autoFocus
                      aria-label={tab === "search" ? "Search" : "Ask AI"}
                      value={query}
                      onChange={(event) => {
                        setQuery(event.target.value);
                      }}
                      placeholder={tab === "search" ? "Search students, staff, classes…" : "Ask AI anything…"}
                      className="min-h-11 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                    />
                  </div>
                </div>

                <div className="flex shrink-0 gap-xs px-md pb-sm">
                  <button
                    type="button"
                    onClick={() => setTab("search")}
                    aria-pressed={tab === "search"}
                    className={`min-h-9 flex-1 rounded-md text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${
                      tab === "search" ? "bg-surface-secondary text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    Search
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab("ai")}
                    aria-pressed={tab === "ai"}
                    className={`min-h-9 flex-1 rounded-md text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${
                      tab === "ai" ? "bg-surface-secondary text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    Ask AI
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto border-t border-border px-sm py-sm">
                  {tab === "ai" ? (
                    <div className="flex flex-col items-center gap-xs px-lg py-2xl text-center">
                      <Sparkles className="size-6 text-accent" aria-hidden="true" />
                      <p className="text-sm font-medium text-foreground">AI assistant coming soon</p>
                      <p className="text-xs text-muted-foreground">Not connected to a model yet.</p>
                    </div>
                  ) : !normalizedQuery && !selectedCategory ? (
                    <div className="grid grid-cols-2 gap-xs">
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
                    <>
                      {selectedCategory && !normalizedQuery && (
                        <button
                          type="button"
                          onClick={() => setSelectedCategory(null)}
                          className="mb-xs flex min-h-9 items-center gap-xs px-sm text-sm text-muted-foreground"
                        >
                          <ArrowLeft className="size-3.5" aria-hidden="true" />
                          All categories
                        </button>
                      )}
                      {groupedResults.map((group) => (
                        <div key={group.category.key} className="mb-sm">
                          <p className="px-sm pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {group.category.label}
                          </p>
                          {group.records.map((record) => (
                            <Link
                              key={record.id}
                              href={record.href}
                              onClick={close}
                              className="flex min-h-11 items-center gap-sm rounded-md px-sm text-sm outline-none transition-colors hover:bg-surface-secondary"
                            >
                              <group.category.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                              <span className="flex-1 truncate text-foreground">{record.title}</span>
                              <span className="shrink-0 truncate text-xs text-muted-foreground">
                                {record.subtitle}
                              </span>
                            </Link>
                          ))}
                        </div>
                      ))}
                      {normalizedQuery && groupedResults.length === 0 && (
                        <p className="px-sm py-lg text-center text-sm text-muted-foreground">
                          No results for &ldquo;{query}&rdquo;.
                        </p>
                      )}
                    </>
                  )}
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
