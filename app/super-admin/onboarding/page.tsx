"use client";

// Real school-onboarding directory (Super Admin SA-3). Lists schools by their
// real onboarding state from /api/super-admin/onboarding — no mock, no fake
// progress. Creating a school lives at /super-admin/schools/new (SA-2).
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useOnboardingList } from "@/lib/hooks/api/use-onboarding";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import type { StatusTone } from "@/lib/types/common";
import { cn } from "@/lib/utils";

const STATUSES = ["all", "in-progress", "completed"] as const;
const PAGE_SIZE = 20;

const statusLabels: Record<string, string> = { "not-started": "Not started", "in-progress": "In progress", completed: "Completed" };
const statusTone: Record<string, StatusTone> = { "not-started": "neutral", "in-progress": "warning", completed: "success" };

export default function OnboardingPage() {
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 250);
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("all");
  const [page, setPage] = useState(1);

  const { data: rows, meta, loading, error, reload } = useOnboardingList({ page, pageSize: PAGE_SIZE, search: debounced || undefined, status });
  const totalPages = meta?.totalPages ?? 1;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Sparkles className="size-5 text-primary" /> School onboarding
        </h1>
        <p className="text-xs text-muted-foreground">{meta ? `${meta.total} schools` : "…"} · real setup progress from PostgreSQL</p>
      </div>

      <div className="flex flex-col gap-sm sm:flex-row sm:items-center">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          placeholder="Search schools, codes…"
          aria-label="Search onboarding"
          className="w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary sm:max-w-sm"
        />
        <div className="flex flex-wrap gap-1">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setStatus(s);
                setPage(1);
              }}
              className={cn(
                "rounded-pill px-2.5 py-1 text-xs font-medium transition",
                status === s ? "bg-primary text-primary-foreground" : "bg-surface-secondary text-muted-foreground hover:text-foreground",
              )}
            >
              {s === "all" ? "All" : statusLabels[s]}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-error/30 bg-error/5 p-md text-sm text-error" role="alert">
          Could not load onboarding: {error}
          <Button variant="outline" size="sm" className="ml-sm" onClick={reload}>
            Retry
          </Button>
        </div>
      ) : loading && rows.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-2xl text-center text-sm text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-2xl text-center text-sm text-muted-foreground">
          No schools in onboarding.{" "}
          <Link href="/super-admin/schools/new" className="text-primary">
            Create a school
          </Link>
          .
        </div>
      ) : (
        <div className="flex flex-col gap-sm">
          {rows.map((o) => (
            <div key={o.schoolId} className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-medium text-foreground">{o.school.name}</p>
                  <Badge tone={statusTone[o.status] ?? "neutral"}>{statusLabels[o.status] ?? o.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {o.school.code} · {o.completedCount}/{o.totalSteps} steps
                </p>
                <div className="mt-1 h-1.5 w-full max-w-xs overflow-hidden rounded-pill bg-surface-secondary">
                  <div className={cn("h-full rounded-pill", o.status === "completed" ? "bg-success" : "bg-primary")} style={{ width: `${o.progress}%` }} />
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-xs">
                {o.status === "completed" ? (
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/super-admin/onboarding/${o.schoolId}`}>
                      <CheckCircle2 className="size-3.5" /> View setup
                    </Link>
                  </Button>
                ) : (
                  <Button asChild size="sm">
                    <Link href={`/super-admin/onboarding/${o.schoolId}`}>
                      Continue setup <ArrowRight className="size-3.5" />
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          ))}

          {meta && totalPages > 1 && (
            <div className="flex items-center justify-between gap-sm text-sm">
              <span className="text-muted-foreground">
                Page {meta.page} of {totalPages}
              </span>
              <div className="flex gap-xs">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Prev
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
