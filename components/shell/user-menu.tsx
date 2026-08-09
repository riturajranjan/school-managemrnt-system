"use client";

import { Check, LogOut, Settings, ShieldUser, User } from "lucide-react";
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
import { logout } from "@/app/(auth)/actions";

// Identity display is still a static placeholder (real user-display binding is a
// later batch). Role comes from the live RBAC context so the "Viewing as"
// switcher below and this label never disagree.
const CURRENT_USER = { name: "Alex Rivera", initials: "AR" };

// One real logout implementation shared by every "Sign out" control here.
function signOut() {
  void logout();
}

export function UserMenu({
  variant = "header",
  collapsed = false,
}: {
  variant?: "header" | "mobile" | "sidebar";
  /** Sidebar-only: rail mode shows the avatar alone, no name/role/chevron. */
  collapsed?: boolean;
}) {
  const { role, setRole } = usePermissions();

  const avatar = (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
      {CURRENT_USER.initials}
    </span>
  );

  // Phase 2 has no auth backend yet — this lets reviewers see the same screen
  // gate/ungate actions per role instead of only trusting the permission
  // matrix in code. Folded into the profile menu (rather than a standalone
  // header control) to keep the header from getting crowded.
  const roleSwitchSection = (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuLabel>Viewing as</DropdownMenuLabel>
      {allRoles.map((r) => (
        <DropdownMenuItem key={r} onSelect={() => setRole(r)}>
          <ShieldUser className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="flex-1">{roleLabels[r]}</span>
          {r === role && <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />}
        </DropdownMenuItem>
      ))}
    </>
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
            <span className="block truncate text-xs text-sidebar-foreground/60">{roleLabels[role]}</span>
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top">
          <DropdownMenuLabel className="normal-case tracking-normal">
            <span className="block text-sm font-medium text-foreground">{CURRENT_USER.name}</span>
            <span className="block text-xs text-muted-foreground">{roleLabels[role]}</span>
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
          {roleSwitchSection}
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-error" onSelect={signOut}>
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
          <span className="block text-xs text-muted-foreground">{roleLabels[role]}</span>
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
        {roleSwitchSection}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-error">
          <LogOut className="size-4 shrink-0" aria-hidden="true" />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
