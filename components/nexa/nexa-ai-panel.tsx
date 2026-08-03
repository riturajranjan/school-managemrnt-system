"use client"

import * as React from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Mic, SendHorizontal, Sparkles, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

const suggestedPrompts = [
  "Summarize today's campus activity",
  "Which students need attendance follow-up?",
  "Draft an announcement about the exhibition",
]

export function NexaAIPanel({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="false"
          aria-label="Nexa AI assistant"
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.97 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="fixed right-4 bottom-42 z-40 flex w-[calc(100%-2rem)] max-w-sm flex-col overflow-hidden rounded-[26px] border border-border bg-popover shadow-float lg:right-8 lg:bottom-26"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border bg-gradient-to-br from-primary/10 via-accent-violet/10 to-accent-cyan/10 px-4 py-3.5">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent-violet text-primary-foreground">
                <Sparkles className="size-4" />
              </span>
              <div className="flex flex-col leading-tight">
                <span className="text-sm font-semibold">Nexa AI</span>
                <span className="text-[11px] text-muted-foreground">Campus intelligence assistant</span>
              </div>
            </div>
            <Button size="icon-sm" variant="ghost" onClick={onClose} aria-label="Close Nexa AI">
              <X />
            </Button>
          </div>

          <div className="flex flex-col gap-3 px-4 py-4">
            <p className="text-sm text-foreground">
              Good morning, Principal. I&apos;ve reviewed the campus this morning — ask me anything or try a
              suggestion below.
            </p>
            <div className="flex flex-col gap-1.5">
              {suggestedPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="rounded-2xl border border-border bg-card px-3 py-2 text-left text-xs text-foreground shadow-control transition-colors hover:border-ring/40"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          <form
            className="flex items-end gap-2 border-t border-border p-3"
            onSubmit={(event) => event.preventDefault()}
          >
            <Textarea
              placeholder="Ask Nexa AI anything about your campus..."
              rows={1}
              className="max-h-24 min-h-9 flex-1 resize-none rounded-2xl"
            />
            <Button type="button" size="icon" variant="outline" className="shrink-0 rounded-full" aria-label="Use voice input">
              <Mic />
            </Button>
            <Button type="submit" size="icon" className="shrink-0 rounded-full" aria-label="Send message">
              <SendHorizontal />
            </Button>
          </form>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
