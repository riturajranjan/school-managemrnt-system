"use client";

import Link from "next/link";
import { use } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StaffForm } from "@/components/hr/staff-form";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useStaff } from "@/lib/hooks/api/use-staff-api";
import { roleLabels } from "@/lib/permissions/roles";

export default function EditStaffPage({ params }: { params: Promise<{ staffId: string }> }) {
  const { staffId } = use(params);
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: staff, loading, error } = useStaff(staffId);

  if (!capabilitiesLoading && !hasServerPermission("hr.manage")) return <PermissionDenied action="edit staff" role={roleLabels[role]} backHref="/hr/staff" />;
  if (loading) return <p className="py-2xl text-center text-sm text-muted-foreground">Loading…</p>;
  if (error || !staff) {
    return (
      <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
        <p className="text-sm font-medium text-foreground">{error ?? "Staff member not found"}</p>
        <Button asChild size="sm" variant="outline"><Link href="/hr/staff">Back to directory</Link></Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-sm">
        <Button asChild size="icon" variant="ghost" aria-label="Back"><Link href={`/hr/staff/${staff.id}`}><ArrowLeft className="size-4" /></Link></Button>
        <div>
          <h1 className="text-lg font-semibold text-foreground">Edit {staff.name}</h1>
          <p className="text-xs text-muted-foreground">{staff.employeeCode}</p>
        </div>
      </div>
      <StaffForm staff={staff} />
    </div>
  );
}
