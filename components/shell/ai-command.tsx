"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { useShell } from "./shell-context";
import { headerIconButtonClass, mobileIconButtonClass } from "./styles";

const EXAMPLE_PROMPTS = [
  "Show me today's absentees",
  "Draft a fee reminder for overdue invoices",
  "Summarize this week's admissions",
  "Which buses are running late today?",
];

export function AiCommandTrigger({ variant = "header" }: { variant?: "header" | "mobile" }) {
  const { setAiCommandOpen } = useShell();

  return (
    <button
      type="button"
      onClick={() => setAiCommandOpen(true)}
      aria-label="Ask AI"
      className={`${variant === "mobile" ? mobileIconButtonClass : headerIconButtonClass} text-accent`}
    >
      <Sparkles className="size-4" aria-hidden="true" />
    </button>
  );
}

export function AiCommandDialog() {
  const { aiCommandOpen, setAiCommandOpen } = useShell();
  const [prompt, setPrompt] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const reduceMotion = useReducedMotion();

  function close() {
    setAiCommandOpen(false);
    setPrompt("");
    setSubmitted(false);
  }

  return (
    <Dialog.Root open={aiCommandOpen} onOpenChange={(open) => (open ? setAiCommandOpen(true) : close())}>
      <AnimatePresence>
        {aiCommandOpen && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                className="fixed inset-0 z-50 bg-black/40"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.15 }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount>
              <motion.div
                className="glass ring-accent/20 fixed inset-x-0 top-24 z-50 mx-auto w-[calc(100%_-_2rem)] max-w-[32rem] overflow-hidden rounded-lg shadow-floating ring-1"
                initial={{ opacity: 0, scale: 0.97, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: -8 }}
                transition={{ duration: reduceMotion ? 0 : 0.15, ease: "easeOut" }}
              >
                <Dialog.Title className="sr-only">Ask AI</Dialog.Title>
                <Dialog.Description className="sr-only">
                  Ask the Novyra AI assistant about your school. This feature is coming soon.
                </Dialog.Description>

                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    setSubmitted(true);
                  }}
                  className="flex items-center gap-sm border-b border-border px-md py-sm"
                >
                  <Sparkles className="size-4 shrink-0 text-accent" aria-hidden="true" />
                  <input
                    autoFocus
                    aria-label="Ask AI anything about your school"
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    placeholder="Ask AI anything about your school…"
                    className="min-h-11 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  />
                  <kbd className="hidden shrink-0 rounded-sm border border-border bg-surface-secondary px-1.5 py-0.5 text-xs text-muted-foreground sm:inline">
                    Esc
                  </kbd>
                </form>

                <div className="p-md">
                  {submitted ? (
                    <div className="flex flex-col items-center gap-xs py-lg text-center">
                      <Sparkles className="size-5 text-accent" aria-hidden="true" />
                      <p className="text-sm font-medium text-foreground">AI assistant coming soon</p>
                      <p className="text-xs text-muted-foreground">
                        Not connected to a model yet — this previews the interaction.
                      </p>
                    </div>
                  ) : (
                    <>
                      <p className="px-sm pb-xs text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Try asking
                      </p>
                      <div className="flex flex-col gap-xs">
                        {EXAMPLE_PROMPTS.map((example) => (
                          <button
                            key={example}
                            type="button"
                            onClick={() => setPrompt(example)}
                            className="flex min-h-11 items-center rounded-md px-sm text-left text-sm text-foreground outline-none transition-colors hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {example}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
