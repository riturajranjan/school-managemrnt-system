"use client";

import Link from "next/link";
import { useState } from "react";
import { Building2, ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSchoolList } from "@/lib/hooks/api/use-platform-schools";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { usePermissions } from "@/components/providers/permissions-provider";
import type { StatusTone } from "@/lib/types/common";
import { cn } from "@/lib/utils";

const STATUSES = ["all", "setup-pending", "active", "suspended", "inactive"] as const;
const PAGE_SIZE = 20;

const statusLabels: Record<string, string> = {
  "setup-pending": "Setup pending",
  active: "Active",
  suspended: "Suspended",
  inactive: "Inactive",
  archived: "Archived",
};
const statusTone: Record<string, StatusTone> = {
  "setup-pending": "warning",
  active: "success",
  suspended: "error",
  inactive: "neutral",
  archived: "neutral",
};

export default function SchoolsDirectoryPage() {
  const { can } = usePermissions();
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 250);
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("all");
  const [page, setPage] = useState(1);

  const { data: schools, meta, loading, error, reload } = useSchoolList({
    page,
    pageSize: PAGE_SIZE,
    search: debounced || undefined,
    status,
  });

  const totalPages = meta?.totalPages ?? 1;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Building2 className="size-5 text-primary" /> Schools
          </h1>
          <p className="text-xs text-muted-foreground">{meta ? `${meta.total} schools` : "…"}</p>
        </div>
        {can("platform.schools.create") && (
          <Button asChild size="sm">
            <Link href="/super-admin/schools/new">
              <Plus className="size-3.5" /> Create school
            </Link>
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-sm sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search schools, codes…"
            aria-label="Search schools"
            className="w-full rounded-md border border-border bg-surface py-1.5 pl-8 pr-3 text-sm text-foreground outline-none focus:border-primary"
          />
        </div>
      </div>
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

      {error ? (
        <div className="rounded-lg border border-error/30 bg-error/5 p-md text-sm text-error" role="alert">
          Could not load schools: {error}
          <Button variant="outline" size="sm" className="ml-sm" onClick={reload}>
            Retry
          </Button>
        </div>
      ) : loading && schools.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-2xl text-center text-sm text-muted-foreground">Loading schools…</div>
      ) : schools.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-2xl text-center text-sm text-muted-foreground">No schools match your filters.</div>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-lg border border-border lg:block">
            <table className="w-full min-w-max text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-secondary/60 text-left text-xs text-muted-foreground">
                  <th className="px-sm py-2">School</th>
                  <th className="px-sm py-2">Code</th>
                  <th className="px-sm py-2">Tenant</th>
                  <th className="px-sm py-2">Branches</th>
                  <th className="px-sm py-2">Session</th>
                  <th className="px-sm py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {schools.map((s) => (
                  <tr key={s.id} className="border-b border-border/60 hover:bg-surface-secondary/30">
                    <td className="px-sm py-2">
                      <Link href={`/super-admin/schools/${s.id}`} className="font-medium text-primary hover:underline">
                        {s.name}
                      </Link>
                    </td>
                    <td className="px-sm py-2 text-muted-foreground">{s.code}</td>
                    <td className="px-sm py-2 text-muted-foreground">{s.tenantName}</td>
                    <td className="px-sm py-2 tabular-nums text-muted-foreground">{s.branchCount}</td>
                    <td className="px-sm py-2 text-muted-foreground">{s.currentSessionName ?? "—"}</td>
                    <td className="px-sm py-2">
                      <Badge tone={statusTone[s.status] ?? "neutral"}>{statusLabels[s.status] ?? s.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-xs lg:hidden">
            {schools.map((s) => (
              <Link key={s.id} href={`/super-admin/schools/${s.id}`} className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-sm">
                <div className="flex items-center justify-between gap-sm">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{s.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {s.code} · {s.tenantName}
                    </p>
                  </div>
                  <Badge tone={statusTone[s.status] ?? "neutral"}>{statusLabels[s.status] ?? s.status}</Badge>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{s.branchCount} branches</span>·<span>{s.currentSessionName ?? "No session"}</span>
                </div>
              </Link>
            ))}
          </div>

          {meta && totalPages > 1 && (
            <div className="flex items-center justify-between gap-sm text-sm">
              <span className="text-muted-foreground">
                Page {meta.page} of {totalPages} · {meta.total} total
              </span>
              <div className="flex gap-xs">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="size-3.5" /> Prev
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  Next <ChevronRight className="size-3.5" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
