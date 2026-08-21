"use client";

// Transport dashboard (Phase 9M) — real PostgreSQL/API cutover. The mock
// "Transport Pulse" gauge and exception feed had no honest real backing
// (no GPS/telemetry/delay data exists), so this is deliberately simple:
// real counts only.
import Link from "next/link";
import { Bus, ClipboardList, MapPinned, UsersRound } from "lucide-react";
import { StatTile } from "@/components/ui/stat-tile";
import { useTransportDashboard } from "@/lib/hooks/api/use-transport-api";
import { formatDate } from "@/lib/utils";

export default function TransportDashboardPage() {
  const { data, loading, error } = useTransportDashboard();
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Transport overview</h1>
        <p className="text-xs text-muted-foreground">{formatDate(today)}</p>
      </div>

      {error ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">{error}</p>
      ) : loading && !data ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Loading…</p>
      ) : data ? (
        <section aria-label="Transport summary" className="grid grid-cols-2 gap-sm sm:grid-cols-3 lg:grid-cols-6">
          <StatTile label="Active vehicles" value={String(data.activeVehicles)} icon={Bus} tone="neutral" />
          <StatTile label="Active routes" value={String(data.activeRoutes)} icon={MapPinned} tone="neutral" />
          <StatTile label="Students assigned" value={String(data.studentsAssigned)} icon={UsersRound} tone="neutral" />
          <StatTile label="Trips today" value={String(data.tripsToday)} icon={ClipboardList} tone="neutral" />
          <StatTile label="In progress" value={String(data.tripsInProgress)} icon={Bus} tone={data.tripsInProgress > 0 ? "info" : "neutral"} />
          <StatTile label="Completed today" value={String(data.tripsCompletedToday)} icon={ClipboardList} tone="success" />
        </section>
      ) : null}

      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2 lg:grid-cols-4">
        <QuickLink href="/transport/trips" icon={ClipboardList} label="Trips" description="Today's trips and lifecycle" />
        <QuickLink href="/transport/routes" icon={MapPinned} label="Routes" description="Stops, crew and vehicle assignment" />
        <QuickLink href="/transport/vehicles" icon={Bus} label="Vehicles" description="Fleet registry and status" />
        <QuickLink href="/transport/assignments" icon={UsersRound} label="Assignments" description="Student and staff transport" />
      </div>
    </div>
  );
}

function QuickLink({ href, icon: Icon, label, description }: { href: string; icon: typeof Bus; label: string; description: string }) {
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
