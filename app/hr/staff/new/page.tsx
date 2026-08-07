"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmployeeForm } from "@/components/hr/employee-form";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { roleLabels } from "@/lib/permissions/roles";

export default function NewEmployeePage() {
  const { can, role } = usePermissions();
  if (!can("hr.manageStaff")) return <PermissionDenied action="add employees" role={roleLabels[role]} backHref="/hr/staff" />;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-sm">
        <Button asChild size="icon" variant="ghost" aria-label="Back"><Link href="/hr/staff"><ArrowLeft className="size-4" /></Link></Button>
        <div>
          <h1 className="text-lg font-semibold text-foreground">Add employee</h1>
          <p className="text-xs text-muted-foreground">Multi-step onboarding form · draft autosaves as you type</p>
        </div>
      </div>
      <EmployeeForm />
    </div>
  );
}
