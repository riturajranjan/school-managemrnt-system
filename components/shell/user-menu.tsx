"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Check, LogOut, MoreVertical, Settings, ShieldUser, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useMyProfile, initialsFrom } from "@/lib/hooks/api/use-account";
import { roleLabels } from "@/lib/permissions/roles";
import { logout } from "@/app/(auth)/actions";

function signOut() {
  void logout();
}

/** Real avatar — the user's photo when set, else their initials. Never a hardcoded placeholder. */
function Avatar({
  name,
  email,
  image,
  className,
  fallbackClassName = "bg-primary text-primary-foreground",
}: {
  name: string | null;
  email: string;
  image: string | null;
  className: string;
  fallbackClassName?: string;
}) {
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element -- small fixed-size avatar, not worth next/image's overhead here
    return <img src={image} alt="" className={`${className} object-cover`} />;
  }
  return <span className={`${className} ${fallbackClassName} flex items-center justify-center font-semibold`}>{initialsFrom(name, email)}</span>;
}

function MenuLink({ href, icon, label, hint }: { href: string; icon: ReactNode; label: string; hint: string }) {
  return (
    <DropdownMenuItem asChild>
      <Link href={href}>
        <span className="flex size-4 shrink-0 items-center justify-center text-muted-foreground">{icon}</span>
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate font-medium text-foreground">{label}</span>
          <span className="truncate text-xs text-muted-foreground">{hint}</span>
        </span>
      </Link>
    </DropdownMenuItem>
  );
}

export function UserMenu({
  variant = "header",
  collapsed = false,
}: {
  variant?: "header" | "mobile" | "sidebar";
  /** Sidebar-only: rail mode shows the avatar alone, no name/role/chevron. */
  collapsed?: boolean;
}) {
  const { role, setRole, assignedRoles } = usePermissions();
  const { data: profile } = useMyProfile();

  const name = profile?.name ?? null;
  const email = profile?.email ?? "";
  const image = profile?.image ?? null;
  const displayName = name ?? email ?? "…";

  const avatar = <Avatar name={name} email={email} image={image} className="flex size-9 shrink-0 items-center justify-center rounded-full text-sm" />;

  // Switch among the roles the user is ACTUALLY assigned (from real capabilities).
  // Selecting one persists via the context API and re-resolves permissions
  // server-side. Hidden when the user has a single role. This can no longer be
  // used to assume an unassigned role.
  const switchableRoles = assignedRoles.filter((r) => r.uiRole);
  const roleSwitchSection =
    switchableRoles.length > 1 ? (
      <>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Switch role</DropdownMenuLabel>
        {switchableRoles.map((r) => (
          <DropdownMenuItem key={r.id} onSelect={() => r.uiRole && setRole(r.uiRole)}>
            <ShieldUser className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="flex-1">{r.uiRole ? roleLabels[r.uiRole] : r.name}</span>
            {r.uiRole === role && <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />}
          </DropdownMenuItem>
        ))}
      </>
    ) : null;

  const identityHeader = (
    <DropdownMenuLabel className="normal-case tracking-normal">
      <span className="flex items-center gap-sm">
        <Avatar name={name} email={email} image={image} className="flex size-9 shrink-0 items-center justify-center rounded-full text-sm" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-foreground">{displayName}</span>
          <span className="block truncate text-xs text-muted-foreground">{roleLabels[role]}</span>
          {email && <span className="block truncate text-xs text-muted-foreground">{email}</span>}
        </span>
      </span>
    </DropdownMenuLabel>
  );

  const menuBody = (
    <>
      {identityHeader}
      <DropdownMenuSeparator />
      <MenuLink href="/profile" icon={<User className="size-4" />} label="My Profile" hint="Personal information" />
      <MenuLink href="/account" icon={<Settings className="size-4" />} label="Account Settings" hint="Security & preferences" />
      {roleSwitchSection}
      <DropdownMenuSeparator />
      <DropdownMenuItem className="text-error focus:text-error" onSelect={signOut}>
        <LogOut className="size-4 shrink-0" aria-hidden="true" />
        <span>Sign Out</span>
      </DropdownMenuItem>
    </>
  );

  if (variant === "sidebar") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          className={`flex min-h-11 w-11 items-center justify-center gap-sm rounded-lg outline-none transition-colors duration-150 hover:bg-sidebar-hover-bg focus-visible:ring-2 focus-visible:ring-sidebar-accent/70 ${
            collapsed ? "" : "lg:w-full lg:justify-start lg:px-xs lg:py-1"
          }`}
          aria-label="Account menu"
        >
          <Avatar
            name={name}
            email={email}
            image={image}
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-sm ring-1 ring-sidebar-active-border shadow-[0_0_10px_-4px_var(--sidebar-active-glow)]"
            fallbackClassName="bg-sidebar-surface-elevated text-sidebar-text"
          />
          <span className={`flex min-w-0 flex-1 items-center gap-xs text-left ${collapsed ? "hidden" : "hidden lg:flex"}`}>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-sidebar-text">{displayName}</span>
              <span className="block truncate text-xs text-sidebar-text-muted">{roleLabels[role]}</span>
            </span>
            <MoreVertical className="size-4 shrink-0 text-sidebar-text-faint" aria-hidden="true" />
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top">
          {menuBody}
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
      <DropdownMenuContent align="end">{menuBody}</DropdownMenuContent>
    </DropdownMenu>
  );
}
