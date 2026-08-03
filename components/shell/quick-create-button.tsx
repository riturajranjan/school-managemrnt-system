"use client";

import { Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createActions } from "./nav-config";

export function QuickCreateButton() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Quick create"
        className="flex min-h-9 items-center gap-xs rounded-pill bg-primary px-md py-xs text-sm font-medium text-primary-foreground shadow-card outline-none transition-colors hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Plus className="size-4" aria-hidden="true" />
        <span className="hidden xl:inline">Quick create</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-72 sm:min-w-96">
        <DropdownMenuLabel>Create new</DropdownMenuLabel>
        <div className="grid grid-cols-1 gap-0.5 sm:grid-cols-2">
          {createActions.map(({ key, label, icon: Icon }) => (
            <DropdownMenuItem key={key}>
              <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="truncate">{label}</span>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
