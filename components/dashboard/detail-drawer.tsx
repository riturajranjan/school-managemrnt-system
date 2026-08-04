"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { useSyncExternalStore, type ReactNode } from "react";

// Below `sm` (640px) a right-side panel has nowhere to go on a 320-430px
// screen, so the drawer becomes a slide-up bottom sheet there instead — same
// component, same data, a layout that actually fits a thumb-reachable zone.
// useSyncExternalStore (not state+effect) so subscribing to matchMedia never
// triggers the "setState during effect" cascading-render footgun.
const MOBILE_QUERY = "(max-width: 639px)";

function subscribeToMobileQuery(callback: () => void) {
  const query = window.matchMedia(MOBILE_QUERY);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function getIsMobileSnapshot() {
  return window.matchMedia(MOBILE_QUERY).matches;
}

function getIsMobileServerSnapshot() {
  return false;
}

function useIsMobileViewport() {
  return useSyncExternalStore(subscribeToMobileQuery, getIsMobileSnapshot, getIsMobileServerSnapshot);
}

// Generic detail surface used by widgets to show item detail inline instead
// of navigating to a full page: a right-side slide-over at sm+, a bottom
// sheet below it. Mirrors the NotificationCenter / MobileMoreSheet patterns.
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
  const isMobile = useIsMobileViewport();

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

            {isMobile ? (
              <Dialog.Content asChild forceMount>
                <motion.div
                  className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col rounded-t-2xl border-t border-border bg-surface shadow-floating"
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeOut" }}
                >
                  <div className="mx-auto mt-sm h-1 w-10 shrink-0 rounded-pill bg-border" aria-hidden="true" />
                  <div className="flex shrink-0 items-center justify-between px-md py-sm">
                    <Dialog.Title className="text-sm font-semibold text-foreground">{title}</Dialog.Title>
                    <Dialog.Close
                      className="flex size-11 items-center justify-center rounded-pill text-muted-foreground outline-none transition-colors active:scale-[0.97] hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label="Close"
                    >
                      <X className="size-[18px]" aria-hidden="true" />
                    </Dialog.Close>
                  </div>
                  {description && <Dialog.Description className="sr-only">{description}</Dialog.Description>}

                  <div className="flex-1 overflow-y-auto px-md py-md">{children}</div>

                  {footer ? (
                    <div className="shrink-0 border-t border-border px-md pt-sm pb-[calc(env(safe-area-inset-bottom)_+_0.75rem)]">
                      {footer}
                    </div>
                  ) : (
                    <div aria-hidden="true" style={{ height: "env(safe-area-inset-bottom)" }} />
                  )}
                </motion.div>
              </Dialog.Content>
            ) : (
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
            )}
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
