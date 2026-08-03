"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { navGroups } from "./nav-config";
import { NavGroup } from "./nav-group";
import { useShell } from "./shell-context";

// Full grouped navigation as a bottom sheet — the mobile stand-in for the
// desktop sidebar, sharing its brand gradient and nav components.
export function MobileMoreSheet() {
  const { mobileMoreOpen, setMobileMoreOpen } = useShell();
  const reduceMotion = useReducedMotion();

  return (
    <Dialog.Root open={mobileMoreOpen} onOpenChange={setMobileMoreOpen}>
      <AnimatePresence>
        {mobileMoreOpen && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                className="fixed inset-0 z-40 bg-black/40 md:hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.15 }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount>
              <motion.div
                className="fixed inset-x-0 bottom-0 z-50 flex max-h-[80vh] flex-col rounded-t-2xl bg-sidebar-gradient text-sidebar-foreground pb-[calc(env(safe-area-inset-bottom)_+_0.5rem)] shadow-floating md:hidden"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeOut" }}
              >
                <div className="mx-auto mt-sm h-1 w-10 shrink-0 rounded-pill bg-white/20" aria-hidden="true" />
                <div className="flex items-center justify-between px-md py-sm">
                  <Dialog.Title className="text-sm font-semibold">Menu</Dialog.Title>
                  <Dialog.Close
                    className="flex size-9 items-center justify-center rounded-pill text-sidebar-foreground/70 transition-colors hover:bg-white/8 hover:text-sidebar-foreground"
                    aria-label="Close"
                  >
                    <X className="size-[18px]" aria-hidden="true" />
                  </Dialog.Close>
                </div>
                <div className="flex flex-col gap-xs overflow-y-auto px-sm pb-sm">
                  {navGroups.map((group, index) => (
                    <div key={group.key}>
                      {index > 0 && <div className="mx-sm mb-xs h-px bg-sidebar-border/30" />}
                      <NavGroup
                        group={group}
                        variant="full"
                        layoutScope="mobile-sheet"
                        defaultOpen={group.key === "main"}
                        onNavigate={() => setMobileMoreOpen(false)}
                      />
                    </div>
                  ))}
                  <div className="mx-sm mb-xs h-px bg-sidebar-border/30" />
                  <div className="flex min-h-11 items-center justify-between gap-sm rounded-lg px-md text-sm font-medium">
                    <span>Appearance</span>
                    <ThemeToggle />
                  </div>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
