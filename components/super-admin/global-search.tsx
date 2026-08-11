"use client";

// Real Super Admin global search (SA-4H). Debounced, permission-aware server
// search over real Schools/Subscriptions/Invoices/Payments/Plans. No mock store,
// no client-side full-dataset filtering, no localStorage. `useApiResource`
// discards stale responses, so an older query never overwrites a newer one.
import Link from "next/link";
import { useState } from "react";
import { Search } from "lucide-react";
import { useGlobalSearch, MIN_SEARCH_LENGTH } from "@/lib/hooks/api/use-search";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";

const TYPE_LABEL: Record<string, string> = {
  school: "School",
  subscription: "Subscription",
  invoice: "Invoice",
  payment: "Payment",
  plan: "Plan",
};

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 250);
  const { data, loading, error } = useGlobalSearch(debounced);

  const active = query.trim().length >= MIN_SEARCH_LENGTH;
  const results = data?.results ?? [];
  // Only show results that belong to the current (debounced) query to avoid a
  // flash of stale content while typing.
  const fresh = active && data?.query === debounced.trim();

  return (
    <div className="relative w-full sm:w-72">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-white/60" />
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && setQuery("")}
        placeholder="Search schools, subscriptions, invoices…"
        aria-label="Global search"
        className="w-full rounded-md border border-white/20 bg-white/10 py-1.5 pl-8 pr-3 text-sm text-white placeholder:text-white/50 outline-none focus:border-white/50"
      />
      {active && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-md border border-border bg-surface text-foreground shadow-lg">
          {error ? (
            <p className="px-3 py-2 text-sm text-error">Search failed. Try again.</p>
          ) : loading && !fresh ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">Searching…</p>
          ) : fresh && results.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">No results found</p>
          ) : (
            results.slice(0, 12).map((r) => (
              <Link
                key={`${r.type}:${r.id}`}
                href={r.href}
                onClick={() => setQuery("")}
                className="flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-surface-secondary/60"
              >
                <span className="min-w-0 truncate">
                  <span className="font-medium text-foreground">{r.title}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{r.subtitle}</span>
                </span>
                <span className="shrink-0 rounded bg-surface-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{TYPE_LABEL[r.type] ?? r.type}</span>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
