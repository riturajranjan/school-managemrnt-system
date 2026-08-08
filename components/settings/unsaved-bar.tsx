"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Sticky bar surfaced whenever a settings form has unsaved (mock) changes.
 * Save/Discard are frontend simulations. */
export function UnsavedBar({
  dirty,
  saved,
  onSave,
  onDiscard,
}: {
  dirty: boolean;
  saved?: boolean;
  onSave: () => void;
  onDiscard: () => void;
}) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence>
      {dirty && (
        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 20 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 20 }}
          className="sticky bottom-3 z-10 mx-auto flex w-full  items-center justify-between gap-sm rounded-xl border border-border bg-surface/95 p-sm shadow-lg backdrop-blur"
          role="status">
          <span className="flex items-center gap-2 text-sm text-foreground">
            <span className="size-2 rounded-full bg-warning" aria-hidden /> You
            have unsaved changes
          </span>
          <div className="flex gap-xs">
            <Button size="sm" variant="ghost" onClick={onDiscard}>
              <RotateCcw className="size-3.5" /> Discard
            </Button>
            <Button size="sm" onClick={onSave}>
              <Save className="size-3.5" /> Save (simulation)
            </Button>
          </div>
        </motion.div>
      )}
      {!dirty && saved && (
        <motion.p
          key="saved"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex items-center gap-1 text-xs text-success">
          <Check className="size-3.5" /> Saved (frontend simulation — not
          persisted to a backend).
        </motion.p>
      )}
    </AnimatePresence>
  );
}
