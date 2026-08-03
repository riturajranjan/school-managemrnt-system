"use client";

import { Calendar, Check, ChevronsUpDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MOCK_SESSIONS } from "./context-data";
import { useShell } from "./shell-context";

export function SessionSelector() {
  const { activeSession, setActiveSession } = useShell();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex min-h-9 items-center gap-sm rounded-md border border-border bg-surface px-sm py-xs text-sm font-medium outline-none transition-colors hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-ring">
        <Calendar className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="hidden xl:inline">{activeSession}</span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Academic session</DropdownMenuLabel>
        {MOCK_SESSIONS.map((session) => (
          <DropdownMenuItem key={session} onSelect={() => setActiveSession(session)}>
            <span className="flex-1">{session}</span>
            {session === activeSession && <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
