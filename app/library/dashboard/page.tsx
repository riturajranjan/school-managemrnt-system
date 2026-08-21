"use client";

// Library dashboard (Phase 9N) — real PostgreSQL/API cutover. The mock
// reading-engagement/popular-book/trend widgets had no honest real backing,
// so this is deliberately simple: real counts only.
import Link from "next/link";
import { AlertTriangle, BookMarked, BookOpen, ScanLine, Users } from "lucide-react";
import { StatTile } from "@/components/ui/stat-tile";
import { useLibraryDashboard } from "@/lib/hooks/api/use-library-api";

export default function LibraryDashboardPage() {
  const { data, loading, error } = useLibraryDashboard();

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Library overview</h1>
        <p className="text-xs text-muted-foreground">Catalogue, circulation and overdue at a glance</p>
      </div>

      {error ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">{error}</p>
      ) : loading && !data ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Loading…</p>
      ) : data ? (
        <section aria-label="Library summary" className="grid grid-cols-2 gap-sm sm:grid-cols-3 lg:grid-cols-4">
          <StatTile label="Total titles" value={String(data.totalTitles)} icon={BookOpen} tone="neutral" />
          <StatTile label="Total copies" value={String(data.totalCopies)} icon={BookMarked} tone="neutral" />
          <StatTile label="Available" value={String(data.availableCopies)} icon={BookMarked} tone="success" />
          <StatTile label="Issued" value={String(data.issuedCopies)} icon={ScanLine} tone="neutral" />
          <StatTile label="Overdue loans" value={String(data.overdueLoans)} icon={AlertTriangle} tone={data.overdueLoans > 0 ? "warning" : "success"} />
          <StatTile label="Lost / damaged" value={String(data.lostDamagedCopies)} icon={AlertTriangle} tone={data.lostDamagedCopies > 0 ? "warning" : "success"} />
          <StatTile label="Issued today" value={String(data.loansToday)} icon={ScanLine} tone="neutral" />
          <StatTile label="Returned today" value={String(data.returnsToday)} icon={BookMarked} tone="neutral" />
        </section>
      ) : null}

      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2 lg:grid-cols-4">
        <QuickLink href="/library/books" icon={BookOpen} label="Catalogue" description="Titles and copies" />
        <QuickLink href="/library/issue-return" icon={ScanLine} label="Issue / Return" description="Circulation desk" />
        <QuickLink href="/library/loans" icon={BookMarked} label="Loans" description="Active and overdue" />
        <QuickLink href="/library/members" icon={Users} label="Borrowers" description="Students and staff" />
      </div>
    </div>
  );
}

function QuickLink({ href, icon: Icon, label, description }: { href: string; icon: typeof BookOpen; label: string; description: string }) {
  return (
    <Link href={href} className="surface-3d flex items-center gap-sm rounded-lg border border-border bg-surface p-md outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:-translate-y-0.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="truncate text-xs text-muted-foreground">{description}</p>
      </div>
    </Link>
  );
}
