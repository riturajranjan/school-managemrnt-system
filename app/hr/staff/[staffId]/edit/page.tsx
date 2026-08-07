"use client";

import Link from "next/link";
import { use } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmployeeForm } from "@/components/hr/employee-form";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";

export default function EditEmployeePage({ params }: { params: Promise<{ staffId: string }> }) {
  const { staffId } = use(params);
  const db = useSisStore();
  const { can, role } = usePermissions();
  const employee = db.employees.find((e) => e.id === staffId);

  if (!can("hr.manageStaff")) return <PermissionDenied action="edit employees" role={roleLabels[role]} backHref="/hr/staff" />;
  if (!employee) {
    return (
      <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
        <p className="text-sm font-medium text-foreground">Employee not found</p>
        <Button asChild size="sm" variant="outline"><Link href="/hr/staff">Back to directory</Link></Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-sm">
        <Button asChild size="icon" variant="ghost" aria-label="Back"><Link href={`/hr/staff/${employee.id}`}><ArrowLeft className="size-4" /></Link></Button>
        <div>
          <h1 className="text-lg font-semibold text-foreground">Edit {employee.firstName} {employee.lastName}</h1>
          <p className="text-xs text-muted-foreground">{employee.employeeCode}</p>
        </div>
      </div>
      <EmployeeForm employee={employee} />
    </div>
  );
}
