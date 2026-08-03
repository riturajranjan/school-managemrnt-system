"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import type { ReactNode } from "react";

// Generic right-side slide-over used by widgets to show item detail inline
// instead of navigating to a full page. Mirrors the NotificationCenter pattern.
export function DetailDrawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
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
                className="fixed inset-y-0 right-0 z-50 flex w-96 max-w-[92vw] flex-col border-l border-border bg-surface shadow-floating"
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeOut" }}
              >
                <div className="flex shrink-0 items-center justify-between border-b border-border px-md py-sm">
                  <Dialog.Title className="text-sm font-semibold text-foreground">{title}</Dialog.Title>
                  <Dialog.Close
                    className="flex size-9 items-center justify-center rounded-pill text-muted-foreground outline-none transition-colors hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="Close"
                  >
                    <X className="size-[18px]" aria-hidden="true" />
                  </Dialog.Close>
                </div>
                {description && <Dialog.Description className="sr-only">{description}</Dialog.Description>}

                <div className="flex-1 overflow-y-auto px-md py-md">{children}</div>

                {footer && <div className="shrink-0 border-t border-border px-md py-sm">{footer}</div>}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
