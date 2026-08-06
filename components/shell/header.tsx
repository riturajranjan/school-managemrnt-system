"use client";

import { ThemeToggle } from "@/components/ui/theme-toggle";
import { AiCommandTrigger } from "./ai-command";
import { Breadcrumb } from "./breadcrumb";
import { CommandPaletteTrigger } from "./command-palette";
import { NotificationTrigger } from "./notification-trigger";
import { QuickCreateButton } from "./quick-create-button";
import { SchoolBranchSwitcher } from "./school-branch-switcher";
import { SessionSelector } from "./session-selector";
import { UserMenu } from "./user-menu";

// Desktop + tablet header. Hidden entirely below md — mobile uses MobileHeader instead.
// School + branch are combined into one control (SchoolBranchSwitcher) and role
// switching lives inside UserMenu's "Viewing as" section, so the row only carries
// controls that are distinct actions, which keeps it from crowding at 1024–1440px.
export function Header() {
  return (
    <header className="hidden h-(--topbar-height) shrink-0 items-center justify-between gap-sm border-b border-border bg-surface/80 px-md backdrop-blur-sm md:flex print:hidden">
      <Breadcrumb />

      <div className="flex shrink-0 items-center gap-xs lg:gap-sm">
        <SchoolBranchSwitcher />
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
