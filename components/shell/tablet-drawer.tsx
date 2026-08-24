"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { navGroups } from "./nav-config";
import { NavGroup } from "./nav-group";
import { useShell } from "./shell-context";

// Tablet-only expandable nav drawer. The desktop sidebar handles its own
// expand/collapse inline, so this overlay only ever opens below the lg breakpoint.
export function TabletDrawer() {
  const { tabletDrawerOpen, setTabletDrawerOpen } = useShell();
  const reduceMotion = useReducedMotion();

  return (
    <Dialog.Root open={tabletDrawerOpen} onOpenChange={setTabletDrawerOpen}>
      <AnimatePresence>
        {tabletDrawerOpen && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                className="fixed inset-0 z-40 bg-black/40 lg:hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.15 }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount>
              <motion.div
                className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[80vw] flex-col bg-sidebar-gradient text-sidebar-foreground shadow-floating lg:hidden"
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ duration: reduceMotion ? 0 : 0.18, ease: "easeOut" }}
              >
                <div className="flex h-(--topbar-height) shrink-0 items-center justify-between border-b border-sidebar-border px-md">
                  <Dialog.Title className="text-sm font-semibold">Novyra Campus OS</Dialog.Title>
                  <Dialog.Close
                    className="flex size-9 items-center justify-center rounded-md text-sidebar-text-faint transition-colors hover:bg-sidebar-hover-bg hover:text-sidebar-text"
                    aria-label="Close menu"
                  >
                    <X className="size-[18px]" aria-hidden="true" />
                  </Dialog.Close>
                </div>
                <nav className="flex flex-1 flex-col gap-xs overflow-y-auto px-sm py-sm" aria-label="Sections">
                  {navGroups.map((group, index) => (
                    <div key={group.key}>
                      {index > 0 && <div className="mx-sm mb-xs h-px bg-sidebar-border-muted" />}
                      <NavGroup
                        group={group}
                        variant="full"
                        layoutScope="tablet-drawer"
                        defaultOpen={group.key === "main" || group.key === "people"}
                        onNavigate={() => setTabletDrawerOpen(false)}
                      />
                    </div>
                  ))}
                </nav>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
