"use client";

// Real PostgreSQL/API cutover (Phase 9F) — reads the live /api/fees/structures
// endpoint. Structure versioning/duplicate/copy-to-new-session were mock-only
// affordances with no real backing (see the schema doc comment's scoping
// note) — dropped rather than faked; a school creates each session's
// structures explicitly.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, FileStack, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FeeTrail } from "@/components/fees/fee-trail";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { setFeeStructureStatusRequest, useFeeStructures } from "@/lib/hooks/api/use-fees-api";
import { roleLabels } from "@/lib/permissions/roles";
import { formatCurrency } from "@/lib/utils";

export default function FeeStructuresPage() {
  const router = useRouter();
  const { data: structures, loading, error, reload } = useFeeStructures();
  const { can, hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const canManage = can("fees.manage");
  if (!capabilitiesLoading && !hasServerPermission("fees.view")) return <PermissionDenied action="view the fees module" role={roleLabels[role]} backHref="/fees" />;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <FeeTrail items={[{ label: "Fees", href: "/fees" }, { label: "Fee Setup", href: "/fees/setup" }, { label: "Fee Structure" }]} />

      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Fee Structure</h1>
          <p className="text-xs text-muted-foreground">Set fees for each class and academic session.</p>
        </div>
        {canManage && (
          <Button asChild size="sm">
            <Link href="/fees/structures/new">
              <Plus className="size-3.5" />
              New Fee Structure
            </Link>
          </Button>
        )}
      </div>

      {error && <p className="rounded-md border border-error/30 bg-error/8 p-sm text-sm text-error">{error}</p>}
      {loading && structures.length === 0 && <p className="text-xs text-muted-foreground">Loading…</p>}

      {!loading && structures.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-surface-secondary text-muted-foreground">
            <FileStack className="size-5" />
          </span>
          <p className="text-sm text-muted-foreground">No fee structure yet. Create your first one before assigning fees to students.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-sm lg:grid-cols-2">
          {structures.map((s) => (
            <div key={s.id} className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
              <div className="flex items-start justify-between gap-sm">
                <button type="button" onClick={() => router.push(`/fees/structures/${s.id}`)} className="min-w-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <p className="truncate text-sm font-semibold text-foreground hover:underline">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.classNames.length > 0 ? s.classNames.join(", ") : "No classes assigned"}</p>
                </button>
                <Badge tone={s.status === "active" ? "success" : s.status === "draft" ? "neutral" : "warning"}>{s.status}</Badge>
              </div>

              <div className="grid grid-cols-2 gap-sm text-xs">
                <div>
                  <p className="text-muted-foreground">Total per student</p>
                  <p className="font-medium text-foreground">{formatCurrency(s.totalAmount)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Classes</p>
                  <p className="font-medium text-foreground">{s.classIds.length}</p>
                </div>
              </div>

              {canManage && (
                <div className="flex flex-wrap items-center gap-xs border-t border-border pt-sm">
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/fees/structures/${s.id}`}>View</Link>
                  </Button>
                  {s.status === "archived" ? (
                    <Button size="sm" variant="outline" onClick={() => setFeeStructureStatusRequest(s.id, "active").then(reload)}>
                      <ArchiveRestore className="size-3.5" />
                      Restore
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" className="text-error" onClick={() => setFeeStructureStatusRequest(s.id, "archived").then(reload)}>
                      <Archive className="size-3.5" />
                      Archive
                    </Button>
                  )}
                  {s.status === "draft" && (
                    <Button size="sm" onClick={() => setFeeStructureStatusRequest(s.id, "active").then(reload)}>
                      Activate
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
