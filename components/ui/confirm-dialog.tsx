"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { Button } from "./button";

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
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
                className="fixed inset-x-0 bottom-0 z-50 w-full rounded-t-2xl border-t border-border bg-surface p-md shadow-floating sm:inset-x-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto  sm:w-[min(100%,theme(spacing.96))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg sm:border"
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
                transition={{
                  duration: reduceMotion ? 0 : 0.18,
                  ease: "easeOut",
                }}>
                <div className="mb-sm flex items-start gap-sm">
                  {destructive && (
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-pill bg-error/15 text-error">
                      <AlertTriangle className="size-4" aria-hidden="true" />
                    </span>
                  )}
                  <div className="min-w-0">
                    <Dialog.Title className="text-sm font-semibold text-foreground">
                      {title}
                    </Dialog.Title>
                    <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                      {description}
                    </Dialog.Description>
                  </div>
                </div>
                <div className="flex justify-end gap-sm pt-sm">
                  <Dialog.Close asChild>
                    <Button variant="outline">{cancelLabel}</Button>
                  </Dialog.Close>
                  <Button
                    variant={destructive ? "destructive" : "primary"}
                    onClick={() => {
                      onConfirm();
                      onOpenChange(false);
                    }}>
                    {confirmLabel}
                  </Button>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
