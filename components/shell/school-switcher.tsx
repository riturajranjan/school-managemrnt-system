"use client";

import { Check, ChevronsUpDown, School } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useShell } from "./shell-context";

export function SchoolSwitcher({ variant = "header" }: { variant?: "header" | "sidebar" }) {
  const { schools, activeSchoolId, activeSchoolName, setActiveSchoolId, contextLoading } = useShell();
  const activeSchool = { name: activeSchoolName || (contextLoading ? "…" : "Select school") };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={
          variant === "sidebar"
            ? "flex min-h-9 w-full items-center gap-sm rounded-lg border border-white/10 bg-white/8 px-sm py-xs text-sm font-medium text-sidebar-foreground outline-none transition-colors hover:bg-white/12 focus-visible:ring-2 focus-visible:ring-sidebar-foreground/60"
            : "flex min-h-9 max-w-24 items-center gap-sm rounded-md border border-border bg-surface px-sm py-xs text-sm font-medium outline-none transition-colors hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-ring xl:max-w-40"
        }
      >
        <School
          className={`size-4 shrink-0 ${variant === "sidebar" ? "text-sidebar-foreground/60" : "text-muted-foreground"}`}
          aria-hidden="true"
        />
        <span className="truncate">{activeSchool.name}</span>
        <ChevronsUpDown
          className={`size-3.5 shrink-0 ${variant === "sidebar" ? "text-sidebar-foreground/60 ml-auto" : "text-muted-foreground"}`}
          aria-hidden="true"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Switch school</DropdownMenuLabel>
        {schools.length === 0 && <DropdownMenuItem disabled>No schools</DropdownMenuItem>}
        {schools.map((school) => (
          <DropdownMenuItem key={school.id} onSelect={() => setActiveSchoolId(school.id)}>
            <span className="flex-1 truncate">{school.name}</span>
            {school.id === activeSchoolId && <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
