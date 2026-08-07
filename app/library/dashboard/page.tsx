"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  BookMarked,
  Download,
  FileDigit,
  Gauge,
  LayoutList,
  Library,
  Plus,
  ScanLine,
  Upload,
  Users,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { MiniBar } from "@/components/dashboard/mini-charts";
import { PulseGauge } from "@/components/dashboard/pulse-gauge";
import { toneClasses } from "@/components/dashboard/tone";
import { StatTile } from "@/components/ui/stat-tile";
import { BookStack } from "@/components/library/book-cover";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useShell } from "@/components/shell/shell-context";
import { useSisStore } from "@/lib/hooks/use-store";
import { libraryExceptions, librarySummary, formatFineTotal } from "@/lib/selectors/library-brief";
import { computeLibraryPulse } from "@/lib/selectors/library-pulse";
import { mostIssuedBooks, titlesNeedingCopies } from "@/lib/selectors/library-reports";
import { formatDate } from "@/lib/utils";

const severityTone = { high: "error", medium: "warning", low: "neutral" } as const;

export default function LibraryDashboardPage() {
  const db = useSisStore();
  const { can } = usePermissions();
  const { activeSession } = useShell();
  const [pulseOpen, setPulseOpen] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const summary = librarySummary(db);
  const exceptions = libraryExceptions(db);
  const pulse = computeLibraryPulse(db);
  const sortedFactors = [...pulse.factors].sort((a, b) => a.score - b.score);
  const popular = mostIssuedBooks(db, 5);
  const needCopies = titlesNeedingCopies(db, 5);
  const canCirculate = can("library.circulate");
  const canManage = can("library.manageCatalogue");

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      {/* Header */}
      <div className="flex flex-col gap-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-sm">
          <BookStack colors={["#022c43", "#18b0c8", "#0f766e", "#7c3aed", "#b45309"]} className="hidden sm:flex" />
          <div>
            <h1 className="text-lg font-semibold text-foreground">Library Command Centre</h1>
            <p className="text-xs text-muted-foreground">
              Central Library · Block A · {activeSession} · {formatDate(today)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-xs">
          {canCirculate && (
            <>
              <Button asChild size="sm">
                <Link href="/library/issue-return">
                  <ScanLine className="size-3.5" /> Scan / Issue
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/library/issue-return?mode=return">
                  <BookMarked className="size-3.5" /> Return
                </Link>
              </Button>
            </>
          )}
          {canManage && (
            <Button asChild size="sm" variant="outline">
              <Link href="/library/books/new">
                <Plus className="size-3.5" /> Add book
              </Link>
            </Button>
          )}
          <Button asChild size="sm" variant="ghost">
            <Link href="/library/catalog">
              <Upload className="size-3.5" /> Import
            </Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link href="/library/reports">
              <Download className="size-3.5" /> Export
            </Link>
          </Button>
        </div>
      </div>

      {/* Summary metrics */}
      <section aria-label="Library summary" className="grid grid-cols-2 gap-sm sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Total titles" value={String(summary.totalTitles)} icon={BookOpen} tone="neutral" />
        <StatTile label="Total copies" value={String(summary.totalCopies)} icon={Library} tone="neutral" />
        <StatTile label="Available" value={String(summary.availableCopies)} icon={BookMarked} tone="success" />
        <StatTile label="Issued" value={String(summary.issuedCopies)} icon={BookMarked} tone="info" />
        <StatTile label="Overdue" value={String(summary.overdueLoans)} icon={AlertTriangle} tone={summary.overdueLoans > 0 ? "warning" : "success"} />
        <StatTile label="Reserved titles" value={String(summary.reservedTitles)} icon={LayoutList} tone="neutral" />
        <StatTile label="Active members" value={String(summary.activeMembers)} icon={Users} tone="neutral" />
        <StatTile label="Fines outstanding" value={formatFineTotal(summary.finesOutstanding)} icon={Wallet} tone={summary.finesOutstanding.minorUnits > 0 ? "warning" : "success"} />
        <StatTile label="Lost / damaged" value={String(summary.lostOrDamaged)} icon={AlertTriangle} tone={summary.lostOrDamaged > 0 ? "warning" : "success"} />
        <StatTile label="Digital resources" value={String(summary.digitalResources)} icon={FileDigit} tone="info" />
        <StatTile label="Due today" value={String(summary.dueToday)} icon={BookMarked} tone={summary.dueToday > 0 ? "info" : "neutral"} />
        <StatTile label="Stock checks due" value={String(summary.pendingStockVerification)} icon={Library} tone={summary.pendingStockVerification > 0 ? "warning" : "success"} />
      </section>

      <div className="grid grid-cols-1 gap-md lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-md">
          {/* Exception feed */}
          <div className="rounded-lg border border-border bg-surface p-md">
            <div className="mb-sm flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">What to handle today</h2>
              <Badge tone={exceptions.length === 0 ? "success" : "warning"}>{exceptions.length} item(s)</Badge>
            </div>
            {exceptions.length === 0 ? (
              <p className="py-md text-center text-sm text-muted-foreground">Everything is up to date. Nothing needs attention right now.</p>
            ) : (
              <ul className="flex flex-col gap-sm">
                {exceptions.map((exception) => (
                  <li key={exception.id}>
                    <Link href={exception.href} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm transition-colors hover:border-primary/40">
                      <div className="flex min-w-0 items-center gap-2">
                        <AlertTriangle className={`size-4 shrink-0 ${exception.severity === "high" ? "text-error" : exception.severity === "medium" ? "text-warning" : "text-muted-foreground"}`} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{exception.label}</p>
                          <p className="truncate text-xs text-muted-foreground">{exception.description}</p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Badge tone={severityTone[exception.severity]}>{exception.severity}</Badge>
                        <ArrowRight className="size-3.5 text-muted-foreground" />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Popular + needs copies */}
          <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-surface p-md">
              <h2 className="mb-sm text-sm font-semibold text-foreground">Popular titles</h2>
              {popular.length === 0 ? (
                <p className="text-xs text-muted-foreground">No loans recorded yet.</p>
              ) : (
                <ul className="flex flex-col gap-xs">
                  {popular.map(({ book, count }) => (
                    <li key={book.id} className="flex items-center justify-between gap-sm">
                      <Link href={`/library/books/${book.id}`} className="truncate text-sm text-foreground hover:underline">
                        {book.title}
                      </Link>
                      <Badge tone="info">{count}×</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-lg border border-border bg-surface p-md">
              <h2 className="mb-sm text-sm font-semibold text-foreground">Needs more copies</h2>
              {needCopies.length === 0 ? (
                <p className="text-xs text-muted-foreground">No titles are under demand pressure.</p>
              ) : (
                <ul className="flex flex-col gap-xs">
                  {needCopies.map(({ book, queue }) => (
                    <li key={book.id} className="flex items-center justify-between gap-sm">
                      <Link href={`/library/books/${book.id}`} className="truncate text-sm text-foreground hover:underline">
                        {book.title}
                      </Link>
                      <Badge tone="warning">{queue} waiting</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Library Pulse */}
        <div className="flex flex-col gap-md">
          <div className="rounded-lg border border-border bg-surface p-md">
            <div className="mb-sm flex items-center justify-between">
              <h2 className="flex items-center gap-1 text-sm font-semibold text-foreground">
                <Gauge className="size-4" /> Library Pulse
              </h2>
              <button type="button" onClick={() => setPulseOpen(true)} className="flex items-center gap-1 text-xs font-medium text-primary">
                <LayoutList className="size-3.5" /> Breakdown
              </button>
            </div>
            <div className="flex flex-col items-center gap-sm">
              <PulseGauge score={pulse.score} factors={pulse.factors} />
              <p className="text-center text-xs text-muted-foreground">
                Strongest: <span className="font-medium text-foreground">{sortedFactors[sortedFactors.length - 1].label}</span> · Main issue: <span className="font-medium text-foreground">{sortedFactors[0].label}</span>
              </p>
              <p className="text-center text-xs text-muted-foreground">
                Recommended: <span className="font-medium text-foreground">Address {sortedFactors[0].label.toLowerCase()}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <DetailDrawer open={pulseOpen} onOpenChange={setPulseOpen} title="Library Pulse breakdown" description="All factors contributing to the composite score">
        <div className="flex flex-col gap-md">
          {pulse.factors.map((factor) => (
            <div key={factor.key} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">{factor.label}</span>
                <span className={toneClasses[factor.tone].text}>{factor.displayValue}</span>
              </div>
              <MiniBar percent={factor.score} toneClassName={toneClasses[factor.tone].dot} />
            </div>
          ))}
        </div>
      </DetailDrawer>
    </div>
  );
}
