"use client";

import { Download, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import type { TimelineCategory, TimelineEvent } from "@/lib/types/common";
import { downloadTextFile, formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { timelineCategoryIcon, timelineCategoryLabel } from "./category-meta";

export function TimelineList({
  events,
  onAddNote,
  emptyMessage = "No activity recorded yet.",
}: {
  events: TimelineEvent[];
  onAddNote?: (body: string) => void;
  emptyMessage?: string;
}) {
  const [search, setSearch] = useState("");
  const [activeCategories, setActiveCategories] = useState<Set<TimelineCategory>>(new Set());
  const [noteText, setNoteText] = useState("");
  const [showNoteForm, setShowNoteForm] = useState(false);

  const categoriesPresent = useMemo(() => {
    const set = new Set<TimelineCategory>();
    events.forEach((e) => set.add(e.category));
    return [...set];
  }, [events]);

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (activeCategories.size > 0 && !activeCategories.has(e.category)) return false;
      if (search && !`${e.title} ${e.detail ?? ""} ${e.actorName}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [events, activeCategories, search]);

  function toggleCategory(category: TimelineCategory) {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }

  function exportTimeline() {
    const lines = filtered.map((e) => `${e.createdAt},${e.category},"${e.title.replace(/"/g, '""')}",${e.actorName}`);
    downloadTextFile("timeline-export.csv", `Date,Category,Title,Actor\n${lines.join("\n")}`);
  }

  return (
    <div className="flex flex-col gap-sm">
      <div className="flex flex-wrap items-center gap-sm">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search timeline…" className="pl-9" />
        </div>
        <Button variant="outline" size="sm" onClick={exportTimeline}>
          <Download className="size-3.5" />
          Export
        </Button>
        {onAddNote && (
          <Button variant="outline" size="sm" onClick={() => setShowNoteForm((v) => !v)}>
            <Plus className="size-3.5" />
            Add note
          </Button>
        )}
      </div>

      {categoriesPresent.length > 1 && (
        <div className="flex flex-wrap gap-1">
          {categoriesPresent.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => toggleCategory(category)}
              className={cn(
                "rounded-pill border px-sm py-1 text-xs font-medium transition-colors",
                activeCategories.has(category) ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-surface-secondary",
              )}
            >
              {timelineCategoryLabel[category]}
            </button>
          ))}
        </div>
      )}

      {showNoteForm && onAddNote && (
        <div className="flex flex-col gap-xs rounded-md border border-border p-sm">
          <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Add a note to this timeline…" rows={2} />
          <Button
            size="sm"
            className="self-end"
            disabled={!noteText.trim()}
            onClick={() => {
              onAddNote(noteText.trim());
              setNoteText("");
              setShowNoteForm(false);
            }}
          >
            Save note
          </Button>
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="py-lg text-center text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <ol className="flex flex-col gap-sm">
          {filtered.map((event) => {
            const Icon = timelineCategoryIcon[event.category];
            return (
              <li key={event.id} className="flex gap-sm">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-pill bg-surface-secondary text-muted-foreground">
                  <Icon className="size-3.5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1 border-b border-border pb-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-sm">
                    <p className="text-sm font-medium text-foreground">{event.title}</p>
                    <time className="shrink-0 text-xs text-muted-foreground">{formatDateTime(event.createdAt)}</time>
                  </div>
                  {event.detail && <p className="text-xs text-muted-foreground">{event.detail}</p>}
                  <p className="text-xs text-muted-foreground">
                    {event.actorName}
                    {event.actorRole ? ` · ${event.actorRole}` : ""}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
