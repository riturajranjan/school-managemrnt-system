"use client"

import * as React from "react"
import { Search } from "lucide-react"

import { cn } from "@/lib/utils"
import { recentSearches, quickSearchActions } from "@/lib/dashboard-data"
import {
  CommandDialog,
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from "@/components/ui/command"
import { Kbd } from "@/components/ui/kbd"

export function GlobalCommandSearch({
  className,
  compact = false,
}: {
  className?: string
  compact?: boolean
}) {
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  return (
    <>
      {compact ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Search"
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-control transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            className
          )}
        >
          <Search className="size-4" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "group flex h-9 w-full max-w-md items-center gap-2.5 rounded-full border border-border bg-card px-3.5 text-sm text-muted-foreground shadow-control transition-colors hover:border-ring/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            className
          )}
        >
          <Search className="size-4 shrink-0" />
          <span className="flex-1 truncate text-left">
            Search students, teachers, classes, payments or actions...
          </span>
          <Kbd>⌘K</Kbd>
        </button>
      )}

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search EduNexa"
        description="Search students, teachers, classes, payments or actions"
      >
        <Command>
          <CommandInput placeholder="Search students, teachers, classes, payments or actions..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Recent">
              {recentSearches.map((item) => (
                <CommandItem key={item.id} onSelect={() => setOpen(false)}>
                  <item.icon className="size-4 text-muted-foreground" />
                  {item.label}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading="Quick actions">
              {quickSearchActions.map((item) => (
                <CommandItem key={item.id} onSelect={() => setOpen(false)}>
                  <item.icon className="size-4 text-muted-foreground" />
                  {item.label}
                  <CommandShortcut>Enter</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
