"use client";

import { Building2, Check, ChevronsUpDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MOCK_BRANCHES } from "./context-data";
import { useShell } from "./shell-context";

export function BranchSwitcher({ variant = "header" }: { variant?: "header" | "sidebar" }) {
  const { activeBranchId, setActiveBranchId } = useShell();
  const activeBranch = MOCK_BRANCHES.find((branch) => branch.id === activeBranchId) ?? MOCK_BRANCHES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={
          variant === "sidebar"
            ? "flex min-h-9 w-full items-center gap-sm rounded-lg border border-white/10 bg-white/8 px-sm py-xs text-sm font-medium text-sidebar-foreground outline-none transition-colors hover:bg-white/12 focus-visible:ring-2 focus-visible:ring-sidebar-foreground/60"
            : "flex min-h-9 max-w-20 items-center gap-sm rounded-md border border-border bg-surface px-sm py-xs text-sm font-medium outline-none transition-colors hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-ring xl:max-w-32"
        }
      >
        <Building2
          className={`size-4 shrink-0 ${variant === "sidebar" ? "text-sidebar-foreground/60" : "text-muted-foreground"}`}
          aria-hidden="true"
        />
        <span className="truncate">{activeBranch.name}</span>
        <ChevronsUpDown
          className={`size-3.5 shrink-0 ${variant === "sidebar" ? "text-sidebar-foreground/60 ml-auto" : "text-muted-foreground"}`}
          aria-hidden="true"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Switch branch</DropdownMenuLabel>
        {MOCK_BRANCHES.map((branch) => (
          <DropdownMenuItem key={branch.id} onSelect={() => setActiveBranchId(branch.id)}>
            <span className="flex-1 truncate">{branch.name}</span>
            {branch.id === activeBranchId && <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
