"use client";

import Link from "next/link";
import {
  BookMarked,
  BookOpen,
  Boxes,
  FileDigit,
  Gauge,
  Layers,
  LibraryBig,
  QrCode,
  ScanLine,
  ScrollText,
  Settings,
  Tags,
  Users,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { useLibraryDashboard } from "@/lib/hooks/api/use-library-api";

const quickLinks = [
  { href: "/library/books", label: "Catalogue", description: "Books, copies and search", icon: BookOpen },
  { href: "/library/issue-return", label: "Issue / Return", description: "Fast circulation desk", icon: ScanLine },
  { href: "/library/loans", label: "Loans", description: "Active loans, overdue and history", icon: BookMarked },
  { href: "/library/reservations", label: "Reservations", description: "Hold queues and pickup readiness", icon: Layers },
  { href: "/library/members", label: "Members", description: "Borrower profiles, cards and history", icon: Users },
  { href: "/library/copies", label: "Copies", description: "Physical copy register and condition", icon: Boxes },
  { href: "/library/fines", label: "Fines", description: "Overdue, lost and damage charges", icon: Wallet },
  { href: "/library/digital", label: "Digital library", description: "E-books, notes, papers and media", icon: FileDigit },
  { href: "/library/shelves", label: "Shelves", description: "Copies grouped by recorded shelf location", icon: LibraryBig },
  { href: "/library/stocktake", label: "Stocktake", description: "Shelf and full-library verification", icon: ScrollText },
  { href: "/library/barcode", label: "Barcode & QR", description: "Generate and print labels", icon: QrCode },
  { href: "/library/categories", label: "Categories", description: "Classification and Dewey codes", icon: Tags },
  { href: "/library/reports", label: "Reports", description: "Reading analytics and utilisation", icon: ScrollText },
  { href: "/library/settings", label: "Settings", description: "Loan rules and library configuration", icon: Settings },
];

export default function LibraryHubPage() {
  const { data } = useLibraryDashboard();

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Library</h1>
          <p className="text-xs text-muted-foreground">Catalogue, circulation, digital resources and stock operations</p>
        </div>
        <Button asChild size="sm">
          <Link href="/library/dashboard">
            <Gauge className="size-3.5" />
            Library overview
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Total titles" value={String(data?.totalTitles ?? 0)} icon={BookOpen} tone="neutral" />
        <StatTile label="Available copies" value={String(data?.availableCopies ?? 0)} icon={BookMarked} tone="success" />
        <StatTile label="Overdue loans" value={String(data?.overdueLoans ?? 0)} icon={ScrollText} tone={(data?.overdueLoans ?? 0) > 0 ? "warning" : "success"} />
        <StatTile label="Issued copies" value={String(data?.issuedCopies ?? 0)} icon={Wallet} tone="neutral" />
      </div>

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
