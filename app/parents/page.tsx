"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Phone, Send, Users } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef, RowAction } from "@/components/data-table/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { StatTile } from "@/components/ui/stat-tile";
import { portalStatusLabels, portalStatusTone } from "@/components/parents/parent-meta";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useParentDirectory, type ParentDirectoryRow } from "@/lib/hooks/use-parents";
import { sendPortalInvite } from "@/lib/services/parents-service";
import { initialsOf } from "@/lib/utils";

export default function ParentsPage() {
  const directory = useParentDirectory();
  const router = useRouter();
  const { can } = usePermissions();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return directory;
    const q = search.toLowerCase();
    return directory.filter((row) => `${row.guardian.firstName} ${row.guardian.lastName} ${row.guardian.contact.phone}`.toLowerCase().includes(q));
  }, [directory, search]);

  const activePortals = directory.filter((r) => r.account.portalStatus === "active").length;
  const notInvited = directory.filter((r) => r.account.portalStatus === "not-invited").length;

  const columns: ColumnDef<ParentDirectoryRow>[] = [
    {
      id: "parent",
      header: "Parent",
      alwaysVisible: true,
      sortValue: (row) => `${row.guardian.firstName} ${row.guardian.lastName}`,
      cell: (row) => (
        <div className="flex items-center gap-sm">
          <Avatar className="size-8">
            <AvatarFallback>{initialsOf(row.guardian.firstName, row.guardian.lastName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {row.guardian.firstName} {row.guardian.lastName}
            </p>
            <p className="truncate text-xs text-muted-foreground">{row.guardian.occupation ?? "—"}</p>
          </div>
        </div>
      ),
    },
    {
      id: "contact",
      header: "Contact",
      cell: (row) => (
        <div className="flex flex-col text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Phone className="size-3" /> {row.guardian.contact.phone}
          </span>
          {row.guardian.contact.email && (
            <span className="flex items-center gap-1">
              <Mail className="size-3" /> {row.guardian.contact.email}
            </span>
          )}
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
        const primary = row.children.find((c) => c.link.isPrimary) ?? row.children[0];
        return <span className="text-sm text-foreground">{primary ? `${primary.student.profile.firstName} ${primary.student.profile.lastName}` : "—"}</span>;
      },
    },
    {
      id: "portal",
      header: "Portal status",
      cell: (row) => <Badge tone={portalStatusTone[row.account.portalStatus]}>{portalStatusLabels[row.account.portalStatus]}</Badge>,
    },
    {
      id: "feeResponsibility",
      header: "Fee responsibility",
      cell: (row) => <span className="text-sm text-foreground">{row.children.some((c) => c.link.isFeeResponsible) ? "Yes" : "No"}</span>,
      defaultVisible: false,
    },
    {
      id: "commPref",
      header: "Communication preference",
      cell: (row) => <span className="text-sm capitalize text-foreground">{row.guardian.communicationPreference}</span>,
      defaultVisible: false,
    },
    {
      id: "lastInteraction",
      header: "Last interaction",
      cell: (row) => <span className="text-xs text-muted-foreground">{row.account.lastLoginAt ? new Date(row.account.lastLoginAt).toLocaleDateString("en-IN") : "—"}</span>,
    },
  ];

  const rowActions: RowAction<ParentDirectoryRow>[] = can("parents.managePortal")
    ? [
        {
          key: "invite",
          label: "Send portal invite",
          icon: <Send className="size-3.5" />,
          onSelect: (row) => sendPortalInvite(row.account.id),
          hidden: (row) => row.account.portalStatus === "active",
        },
      ]
    : [];

  return (
    <div className="flex flex-col gap-md">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Parents</h1>
        <p className="text-xs text-muted-foreground">Guardian directory and portal access</p>
      </div>

      <section className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Total guardians" value={String(directory.length)} icon={Users} tone="neutral" />
        <StatTile label="Active portal" value={String(activePortals)} icon={Users} tone="success" />
        <StatTile label="Not invited" value={String(notInvited)} icon={Users} tone="warning" />
        <StatTile label="Total children linked" value={String(directory.reduce((sum, r) => sum + r.children.length, 0))} icon={Users} tone="info" />
      </section>

      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search parents…" className="max-w-xs" />

      <DataTable
        columns={columns}
        rows={filtered}
        getRowId={(row) => row.account.id}
        caption="Parents directory"
        onRowClick={(row) => router.push(`/parents/${row.account.id}`)}
        rowActions={rowActions}
        isFiltered={search.length > 0}
        emptyTitle="No parents yet"
        renderMobileCard={(row) => (
          <button
            type="button"
            onClick={() => router.push(`/parents/${row.account.id}`)}
            className="surface-3d flex w-full items-center gap-sm rounded-lg border border-border bg-surface p-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]"
          >
            <Avatar className="size-10">
              <AvatarFallback>{initialsOf(row.guardian.firstName, row.guardian.lastName)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-xs">
                <p className="truncate text-sm font-semibold text-foreground">
                  {row.guardian.firstName} {row.guardian.lastName}
                </p>
                <Badge tone={portalStatusTone[row.account.portalStatus]}>{portalStatusLabels[row.account.portalStatus]}</Badge>
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {row.children.length} child{row.children.length === 1 ? "" : "ren"} · {row.guardian.contact.phone}
              </p>
            </div>
          </button>
        )}
      />
    </div>
  );
}
