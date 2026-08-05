"use client";

import { Calendar1, Download, MapPin, Upload, UserPlus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MOCK_BRANCHES } from "@/components/shell/context-data";
import { useShell } from "@/components/shell/shell-context";
import { usePermissions } from "@/components/providers/permissions-provider";

export function AdmissionsHeader({ onImport, onExport }: { onImport: () => void; onExport: () => void }) {
  const { activeSession, activeBranchId } = useShell();
  const { can } = usePermissions();
  const branchName = MOCK_BRANCHES.find((b) => b.id === activeBranchId)?.name ?? "Main Campus";

  return (
    <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Admissions</h1>
        <div className="mt-1 flex flex-wrap items-center gap-x-sm gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Calendar1 className="size-3.5" aria-hidden="true" />
            {activeSession}
          </span>
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3.5" aria-hidden="true" />
            {branchName}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-xs">
        <Button variant="outline" size="sm" onClick={onImport}>
          <Upload className="size-3.5" aria-hidden="true" />
          Import
        </Button>
        <Button variant="outline" size="sm" onClick={onExport}>
          <Download className="size-3.5" aria-hidden="true" />
          Export
        </Button>
        {can("admissions.create") && (
          <Button asChild size="sm">
            <Link href="/admissions/new">
              <UserPlus className="size-3.5" aria-hidden="true" />
              New application
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
