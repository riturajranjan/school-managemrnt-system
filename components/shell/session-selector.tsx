"use client";

import { Calendar, Check, ChevronsUpDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useShell } from "./shell-context";

export function SessionSelector() {
  const { sessions, activeSessionId, activeSession, setActiveSessionId, contextLoading } = useShell();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex min-h-9 items-center gap-sm rounded-md border border-border bg-surface px-sm py-xs text-sm font-medium outline-none transition-colors hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-ring">
        <Calendar className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="hidden xl:inline">{activeSession || (contextLoading ? "…" : "Session")}</span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Academic session</DropdownMenuLabel>
        {sessions.length === 0 && <DropdownMenuItem disabled>No sessions</DropdownMenuItem>}
        {sessions.map((session) => (
          <DropdownMenuItem key={session.id} onSelect={() => setActiveSessionId(session.id)}>
            <span className="flex-1">{session.name}</span>
            {session.id === activeSessionId && <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
