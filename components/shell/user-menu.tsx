"use client";

import { LogOut, Settings, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// No auth wired up yet — static placeholder identity.
const CURRENT_USER = { name: "Alex Rivera", role: "Administrator", initials: "AR" };

export function UserMenu({
  variant = "header",
  collapsed = false,
}: {
  variant?: "header" | "mobile" | "sidebar";
  /** Sidebar-only: rail mode shows the avatar alone, no name/role/chevron. */
  collapsed?: boolean;
}) {
  const avatar = (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
      {CURRENT_USER.initials}
    </span>
  );

  if (variant === "sidebar") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          className={`flex min-h-11 w-11 items-center justify-center gap-sm rounded-lg outline-none transition-colors hover:bg-white/8 focus-visible:ring-2 focus-visible:ring-sidebar-foreground/60 ${
            collapsed ? "" : "lg:w-full lg:justify-start lg:px-sm"
          }`}
          aria-label="Account menu"
        >
          {avatar}
          <span className={`min-w-0 flex-1 text-left ${collapsed ? "hidden" : "hidden lg:block"}`}>
            <span className="block truncate text-sm font-medium text-sidebar-foreground">{CURRENT_USER.name}</span>
            <span className="block truncate text-xs text-sidebar-foreground/60">{CURRENT_USER.role}</span>
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top">
          <DropdownMenuLabel className="normal-case tracking-normal">
            <span className="block text-sm font-medium text-foreground">{CURRENT_USER.name}</span>
            <span className="block text-xs text-muted-foreground">{CURRENT_USER.role}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <User className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span>Profile</span>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Settings className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span>Settings</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-error">
            <LogOut className="size-4 shrink-0" aria-hidden="true" />
            <span>Sign out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={
          variant === "mobile"
            ? "flex size-11 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
            : "flex items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
        }
        aria-label="Account menu"
      >
        {avatar}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="normal-case tracking-normal">
          <span className="block text-sm font-medium text-foreground">{CURRENT_USER.name}</span>
          <span className="block text-xs text-muted-foreground">{CURRENT_USER.role}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <User className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span>Profile</span>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Settings className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span>Settings</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-error">
          <LogOut className="size-4 shrink-0" aria-hidden="true" />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
