"use client";

// My Library (Phase 9N) — real self-service for staff borrowers, resolved
// via Staff.userId (never a client-supplied identity). No library.*
// permission required — this is ownership-based, not role-based.
import { BookMarked } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { renewLoanRequest, useMyLibraryLoans } from "@/lib/hooks/api/use-library-api";
import { formatDate } from "@/lib/utils";

export default function MyLibraryPage() {
  const { data: loans, loading, error, reload } = useMyLibraryLoans();
  const active = loans.filter((l) => l.status === "issued");
  const history = loans.filter((l) => l.status !== "issued");

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">My library</h1>
        <p className="text-xs text-muted-foreground">Books currently issued to you and your borrowing history</p>
      </div>

      {error ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">{error}</p>
      ) : loading && loans.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <section className="flex flex-col gap-sm">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground"><BookMarked className="size-4" /> Active loans</h2>
            <div className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
              {active.map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-sm p-sm">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{l.bookTitle}</p>
                    <p className="text-xs text-muted-foreground">Due {formatDate(l.dueAt)}{l.renewalCount > 0 ? ` · renewed ${l.renewalCount}×` : ""}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-xs">
                    {l.isOverdue && <Badge tone="error">{l.daysOverdue}d overdue</Badge>}
                    <Button size="sm" variant="outline" onClick={async () => { await renewLoanRequest(l.id); reload(); }}>Renew</Button>
                  </div>
                </div>
              ))}
              {active.length === 0 && <p className="p-md text-center text-sm text-muted-foreground">No books currently issued to you.</p>}
            </div>
          </section>

          <section className="flex flex-col gap-sm">
            <h2 className="text-sm font-semibold text-foreground">History</h2>
            <div className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
              {history.map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-sm p-sm">
                  <p className="truncate text-sm text-foreground">{l.bookTitle}</p>
                  <Badge tone={l.status === "lost" ? "error" : "neutral"}>{l.status}</Badge>
                </div>
              ))}
              {history.length === 0 && <p className="p-md text-center text-sm text-muted-foreground">No history yet.</p>}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
