"use client";

import { Check, ChevronsUpDown, ShieldUser } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePermissions } from "@/components/providers/permissions-provider";
import { allRoles, roleLabels } from "@/lib/permissions/roles";

// Phase 2 has no auth backend yet — this lets reviewers see the same screen
// gate/ungate actions per role instead of only trusting the permission
// matrix in code. Kept separate from SchoolSwitcher/BranchSwitcher so it
// reads as a demo/QA control, not a tenant-scoping control.
export function RoleSwitcher() {
  const { role, setRole } = usePermissions();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex min-h-9 items-center gap-sm rounded-md border border-border bg-surface px-sm py-xs text-sm font-medium outline-none transition-colors hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-ring">
        <ShieldUser className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="hidden xl:inline">Viewing as {roleLabels[role]}</span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Viewing as</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {allRoles.map((r) => (
          <DropdownMenuItem key={r} onSelect={() => setRole(r)}>
            <span className="flex-1">{roleLabels[r]}</span>
            {r === role && <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
