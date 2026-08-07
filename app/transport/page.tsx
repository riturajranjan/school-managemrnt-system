"use client";

import Link from "next/link";
import {
  AlertTriangle,
  Bell,
  Bus,
  ClipboardList,
  Fuel,
  Gauge,
  MapPinned,
  Route,
  ScrollText,
  Settings,
  UserCog,
  Users,
  UsersRound,
  Wallet,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { useSisStore } from "@/lib/hooks/use-store";
import { transportDocumentStatusLabels } from "@/lib/types/transport";

const quickLinks = [
  { href: "/transport/routes", label: "Routes", description: "Route builder, stops and vehicle assignment", icon: Route },
  { href: "/transport/stops", label: "Stops", description: "Pickup and drop points, safety flags", icon: MapPinned },
  { href: "/transport/vehicles", label: "Vehicles", description: "Fleet, seating, documents and health", icon: Bus },
  { href: "/transport/drivers", label: "Drivers", description: "Driver profiles, licenses and safety score", icon: UserCog },
  { href: "/transport/attendants", label: "Attendants", description: "Attendant profiles and assignments", icon: Users },
  { href: "/transport/trips", label: "Trips", description: "Today's trips, stop timelines and status", icon: ClipboardList },
  { href: "/transport/student-assignments", label: "Student assignments", description: "Assign students to routes and seats", icon: UsersRound },
  { href: "/transport/attendance", label: "Transport attendance", description: "Boarding and drop attendance by route", icon: ClipboardList },
  { href: "/transport/incidents", label: "Incidents", description: "Report and track transport incidents", icon: AlertTriangle },
  { href: "/transport/maintenance", label: "Maintenance", description: "Service schedule and repair history", icon: Wrench },
  { href: "/transport/fuel", label: "Fuel", description: "Fuel entries and efficiency analytics", icon: Fuel },
  { href: "/transport/documents", label: "Documents", description: "Vehicle and driver compliance tracking", icon: ScrollText },
  { href: "/transport/fees", label: "Transport fees", description: "Route-based fee rules and collection", icon: Wallet },
  { href: "/transport/notifications", label: "Notifications", description: "Parent alerts and communication rules", icon: Bell },
  { href: "/transport/reports", label: "Reports", description: "Utilization, delays, costs and compliance", icon: ScrollText },
  { href: "/transport/settings", label: "Settings", description: "Shifts, branches and policy configuration", icon: Settings },
];

export default function TransportHubPage() {
  const db = useSisStore();

  const activeVehicles = db.vehicles.filter((v) => v.status === "assigned" || v.status === "in-service").length;
  const activeRoutes = db.transportRoutes.filter((r) => r.status === "active").length;
  const studentsOnTransport = db.studentTransportAssignments.filter((a) => a.status === "active").length;
  const openIncidents = db.transportIncidents.filter((i) => i.status === "open" || i.status === "investigating" || i.status === "action-required" || i.status === "escalated").length;
  const expiringDocs = [...db.vehicleDocuments.filter((d) => d.status !== "valid"), ...db.driverDocuments.filter((d) => d.status !== "valid")].length;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Transport</h1>
          <p className="text-xs text-muted-foreground">Fleet, routes, drivers and student transport operations</p>
        </div>
        <Button asChild size="sm">
          <Link href="/transport/dashboard">
            <Gauge className="size-3.5" />
            Transport Command Centre
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Active vehicles" value={String(activeVehicles)} icon={Bus} tone="success" />
        <StatTile label="Active routes" value={String(activeRoutes)} icon={Route} tone="neutral" />
        <StatTile label="Students on transport" value={String(studentsOnTransport)} icon={UsersRound} tone="neutral" />
        <StatTile label="Open incidents" value={String(openIncidents)} icon={AlertTriangle} tone={openIncidents > 0 ? "warning" : "success"} />
      </div>

      {expiringDocs > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-warning/30 bg-warning/8 p-sm text-sm text-warning">
          <span>
            {expiringDocs} document{expiringDocs === 1 ? "" : "s"} need attention ({transportDocumentStatusLabels["expiring-soon"]}/{transportDocumentStatusLabels.expired})
          </span>
          <Link href="/transport/documents" className="underline underline-offset-2">
            Review
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2 lg:grid-cols-3">
        {quickLinks.map(({ href, label, description, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="surface-3d flex items-center gap-sm rounded-lg border border-border bg-surface p-md outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:-translate-y-0.5"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Icon className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{label}</p>
              <p className="truncate text-xs text-muted-foreground">{description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
