"use client";

import { Building2, Check, ChevronsUpDown, School } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useShell } from "./shell-context";

// Combines the school and branch pickers into one header control so the
// header doesn't need two near-identical dropdown buttons side by side.
// The sidebar keeps the standalone SchoolSwitcher (it has room for it).
export function SchoolBranchSwitcher() {
  const {
    schools,
    branches,
    activeSchoolId,
    activeSchoolName,
    activeBranchId,
    activeBranchName,
    setActiveSchoolId,
    setActiveBranchId,
    contextLoading,
  } = useShell();
  const activeSchool = { name: activeSchoolName || (contextLoading ? "…" : "Select school") };
  const activeBranch = { name: activeBranchName || "All branches" };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex min-h-9 max-w-28 items-center gap-sm rounded-md border border-border bg-surface px-sm py-xs text-sm font-medium outline-none transition-colors hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-ring xl:max-w-56"
        aria-label="Switch school or branch"
      >
        <School className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="truncate">
          {activeSchool.name}
          <span className="hidden text-muted-foreground xl:inline"> · {activeBranch.name}</span>
        </span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>School</DropdownMenuLabel>
        {schools.length === 0 && <DropdownMenuItem disabled>No schools</DropdownMenuItem>}
        {schools.map((school) => (
          <DropdownMenuItem key={school.id} onSelect={() => setActiveSchoolId(school.id)}>
            <span className="flex-1 truncate">{school.name}</span>
            {school.id === activeSchoolId && <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Branch</DropdownMenuLabel>
        {branches.length === 0 && <DropdownMenuItem disabled>No branches</DropdownMenuItem>}
        {branches.map((branch) => (
          <DropdownMenuItem key={branch.id} onSelect={() => setActiveBranchId(branch.id)}>
            <Building2 className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="flex-1 truncate">{branch.name}</span>
            {branch.id === activeBranchId && <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
