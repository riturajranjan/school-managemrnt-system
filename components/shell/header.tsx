"use client";

import { ThemeToggle } from "@/components/ui/theme-toggle";
import { AiCommandTrigger } from "./ai-command";
import { BranchSwitcher } from "./branch-switcher";
import { Breadcrumb } from "./breadcrumb";
import { CommandPaletteTrigger } from "./command-palette";
import { NotificationTrigger } from "./notification-trigger";
import { QuickCreateButton } from "./quick-create-button";
import { SchoolSwitcher } from "./school-switcher";
import { SessionSelector } from "./session-selector";
import { UserMenu } from "./user-menu";

// Desktop + tablet header. Hidden entirely below md — mobile uses MobileHeader instead.
// Right-side controls degrade in stages as width shrinks. The full-label
// controls (branch switcher, search pill) only appear at xl, not lg: the
// sidebar itself jumps from a 76px rail to a 248px column exactly at lg, so
// adding header width at that same breakpoint reliably overflowed the row.
export function Header() {
  return (
    <header className="hidden h-(--topbar-height) shrink-0 items-center justify-between gap-sm border-b border-border bg-surface/80 px-md backdrop-blur-sm md:flex">
      <Breadcrumb />

      <div className="flex shrink-0 items-center gap-xs lg:gap-sm">
        <SchoolSwitcher />
        <div className="hidden xl:block">
          <BranchSwitcher />
        </div>
        <SessionSelector />

        <div className="hidden xl:block">
          <CommandPaletteTrigger />
        </div>
        <div className="xl:hidden">
          <CommandPaletteTrigger variant="mobile" />
        </div>

        <AiCommandTrigger />
        <QuickCreateButton />
        <NotificationTrigger />
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
