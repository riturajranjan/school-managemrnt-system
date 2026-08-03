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

// Floating quick-create action, mobile only. Sits above the bottom nav with
// safe-area awareness so it never sits under a home-indicator gesture bar.
export function MobileFab() {
  return (
    <div className="fixed right-4 bottom-[calc(var(--mobile-bottom-nav-height)_+_env(safe-area-inset-bottom)_+_1rem)] z-30 md:hidden">
      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-floating outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring active:scale-95"
          aria-label="Quick create"
        >
          <Plus className="size-6" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="min-w-64">
          <DropdownMenuLabel>Create new</DropdownMenuLabel>
          {createActions.map(({ key, label, icon: Icon }) => (
            <DropdownMenuItem key={key}>
              <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span>{label}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
