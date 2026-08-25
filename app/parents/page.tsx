"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Phone, Users } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef } from "@/components/data-table/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { roleLabels } from "@/lib/permissions/roles";
import { useGuardianDirectory } from "@/lib/hooks/api/use-guardians";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import type { GuardianDto } from "@/lib/api/contracts";
import { initialsOf } from "@/lib/utils";

export default function ParentsPage() {
  const router = useRouter();
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 250);
  // Real, server-backed guardian directory (no mock store).
  const { data: guardians, meta, loading, error } = useGuardianDirectory(debouncedSearch);

  const withPortal = useMemo(() => guardians.filter((g) => g.hasPortalAccount).length, [guardians]);
  const childrenLinked = useMemo(() => guardians.reduce((sum, g) => sum + g.children.length, 0), [guardians]);
  const totalGuardians = meta?.total ?? guardians.length;

  if (!capabilitiesLoading && !hasServerPermission("guardians.view")) {
    return <PermissionDenied action="view the parents directory" role={roleLabels[role]} backHref="/" />;
  }

  const columns: ColumnDef<GuardianDto>[] = [
    {
      id: "parent",
      header: "Parent",
      alwaysVisible: true,
      sortValue: (row) => row.fullName,
      cell: (row) => (
        <div className="flex items-center gap-sm">
          <Avatar className="size-8">
            <AvatarFallback>{initialsOf(row.firstName, row.lastName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{row.fullName}</p>
            <p className="truncate text-xs text-muted-foreground">{row.occupation ?? "—"}</p>
          </div>
        </div>
      ),
    },
    {
      id: "contact",
      header: "Contact",
      cell: (row) => (
        <div className="flex flex-col text-xs text-muted-foreground">
          {row.phone && (
            <span className="flex items-center gap-1">
              <Phone className="size-3" /> {row.phone}
            </span>
          )}
          {row.email && (
            <span className="flex items-center gap-1">
              <Mail className="size-3" /> {row.email}
            </span>
          )}
          {!row.phone && !row.email && "—"}
        </div>
      ),
    },
    {
      id: "children",
      header: "Children",
      cell: (row) => <span className="text-sm text-foreground">{row.children.length}</span>,
    },
    {
      id: "primaryChild",
      header: "Primary child",
      cell: (row) => {
        const primary = row.children.find((c) => c.isPrimary) ?? row.children[0];
        return <span className="text-sm text-foreground">{primary ? primary.student.name : "—"}</span>;
      },
    },
    {
      id: "portal",
      header: "Portal account",
      cell: (row) => (
        <Badge tone={row.hasPortalAccount ? "success" : "neutral"}>{row.hasPortalAccount ? "Active" : "Not invited"}</Badge>
      ),
    },
    {
      id: "feeResponsibility",
      header: "Fee responsibility",
      cell: (row) => (
        <span className="text-sm text-foreground">{row.children.some((c) => c.isFeeResponsible) ? "Yes" : "No"}</span>
      ),
      defaultVisible: false,
    },
  ];

  return (
    <div className="flex flex-col gap-md">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Parents</h1>
        <p className="text-xs text-muted-foreground">Guardian directory and portal access</p>
      </div>

      <section className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Total guardians" value={String(totalGuardians)} icon={Users} tone="neutral" />
        <StatTile label="Portal accounts" value={String(withPortal)} icon={Users} tone="success" />
        <StatTile label="No portal yet" value={String(totalGuardians - withPortal)} icon={Users} tone="warning" />
        <StatTile label="Children linked" value={String(childrenLinked)} icon={Users} tone="info" />
      </section>

      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search parents…" />

      {error ? (
        <div className="rounded-lg border border-error/30 bg-error/5 p-md text-sm text-error" role="alert">
          Could not load guardians: {error}
        </div>
      ) : loading && guardians.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-2xl text-center text-sm text-muted-foreground">Loading guardians…</div>
      ) : (
        <DataTable
          columns={columns}
          rows={guardians}
          getRowId={(row) => row.id}
          caption="Parents directory"
          onRowClick={(row) => router.push(`/parents/${row.id}`)}
          isFiltered={search.length > 0}
          emptyTitle="No parents yet"
          renderMobileCard={(row) => (
            <button
              type="button"
              onClick={() => router.push(`/parents/${row.id}`)}
              className="surface-3d flex w-full items-center gap-sm rounded-lg border border-border bg-surface p-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]">
              <Avatar className="size-10">
                <AvatarFallback>{initialsOf(row.firstName, row.lastName)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-xs">
                  <p className="truncate text-sm font-semibold text-foreground">{row.fullName}</p>
                  <Badge tone={row.hasPortalAccount ? "success" : "neutral"}>{row.hasPortalAccount ? "Active" : "Not invited"}</Badge>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {row.children.length} child{row.children.length === 1 ? "" : "ren"}
                  {row.phone ? ` · ${row.phone}` : ""}
                </p>
              </div>
            </button>
          )}
        />
      )}
    </div>
  );
}
