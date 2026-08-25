"use client";

import Link from "next/link";
import { use } from "react";
import { Mail, Phone, Users } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { roleLabels } from "@/lib/permissions/roles";
import { studentStatusTone } from "@/components/students/student-meta";
import { useGuardian } from "@/lib/hooks/api/use-guardians";
import { studentStatusLabels, type StudentStatus } from "@/lib/types/students";
import { initialsOf } from "@/lib/utils";

// Phase 4: real guardian identity, linked children, relations and pickup/fee
// flags come from the live API. Family fee summary, payment links, consent forms
// and portal login history intentionally stay OUT until the fees/portal modules
// are migrated (spec §24 — do not fake other modules' data here).
export default function ParentProfilePage({ params }: { params: Promise<{ parentId: string }> }) {
  const { parentId } = use(params);
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: guardian, loading, error } = useGuardian(parentId);

  if (!capabilitiesLoading && !hasServerPermission("guardians.view")) {
    return <PermissionDenied action="view this parent profile" role={roleLabels[role]} backHref="/parents" />;
  }

  if (loading) {
    return <div className="py-2xl text-center text-sm text-muted-foreground">Loading guardian…</div>;
  }
  if (error || !guardian) {
    return (
      <div className="flex flex-col items-center gap-sm py-2xl text-center">
        <p className="text-sm font-medium text-foreground">{error ? "Could not load guardian" : "Parent not found"}</p>
        {error && <p className="text-xs text-muted-foreground">{error}</p>}
        <Button asChild variant="outline">
          <Link href="/parents">Back to Parents</Link>
        </Button>
      </div>
    );
  }

  const children = guardian.children;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-sm sm:flex-row sm:items-start sm:justify-between sm:p-md">
        <div className="flex items-start gap-sm">
          <Avatar className="size-12">
            <AvatarFallback>{initialsOf(guardian.firstName, guardian.lastName)}</AvatarFallback>
          </Avatar>
          <div>
            <div className="flex flex-wrap items-center gap-xs">
              <h1 className="text-base font-semibold text-foreground">{guardian.fullName}</h1>
              <Badge tone={guardian.hasPortalAccount ? "success" : "neutral"}>
                {guardian.hasPortalAccount ? "Portal active" : "No portal"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {guardian.occupation ?? "—"}
              {guardian.organization ? ` · ${guardian.organization}` : ""}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-sm gap-y-1 text-xs text-muted-foreground">
              {guardian.phone && (
                <span className="inline-flex items-center gap-1">
                  <Phone className="size-3" /> {guardian.phone}
                </span>
              )}
              {guardian.email && (
                <span className="inline-flex items-center gap-1">
                  <Mail className="size-3" /> {guardian.email}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-md lg:grid-cols-2">
        <div className="rounded-lg border border-border p-sm">
          <h2 className="mb-sm text-sm font-semibold text-foreground">Linked children</h2>
          <ul className="flex flex-col gap-sm">
            {children.map((c) => (
              <li key={c.student.id} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm">
                <Link href={`/students/${c.student.id}`} className="min-w-0 flex-1 hover:underline">
                  <p className="truncate text-sm font-medium text-foreground">{c.student.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {[c.student.classLabel, c.student.sectionLabel].filter(Boolean).join("-") || "—"} · {c.relation}
                    {c.isPrimary ? " · primary" : ""}
                  </p>
                </Link>
                <Badge tone={studentStatusTone[c.student.status as StudentStatus] ?? "neutral"}>
                  {studentStatusLabels[c.student.status as StudentStatus] ?? c.student.status}
                </Badge>
              </li>
            ))}
            {children.length === 0 && <p className="text-sm text-muted-foreground">No children linked yet.</p>}
          </ul>
        </div>

        <div className="rounded-lg border border-border p-sm">
          <h2 className="mb-sm text-sm font-semibold text-foreground">Pickup &amp; fee responsibility</h2>
          <ul className="flex flex-col gap-sm">
            {children.map((c) => (
              <li key={c.student.id} className="flex items-center justify-between gap-sm text-sm">
                <span className="text-foreground">{c.student.name}</span>
                <div className="flex items-center gap-xs">
                  {c.authorizedPickup && <Badge tone="success">Pickup</Badge>}
                  {c.isEmergencyContact && <Badge tone="info">Emergency</Badge>}
                  {c.isFeeResponsible && <Badge tone="warning">Fee payer</Badge>}
                  {!c.authorizedPickup && !c.isEmergencyContact && !c.isFeeResponsible && (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
              </li>
            ))}
            {children.length === 0 && (
              <p className="flex items-center gap-1 text-sm text-muted-foreground">
                <Users className="size-4" /> No children linked yet.
              </p>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
