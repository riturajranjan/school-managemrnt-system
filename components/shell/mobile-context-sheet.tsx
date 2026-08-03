"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Building2, Calendar, Check, School, X, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { MOCK_BRANCHES, MOCK_SCHOOLS, MOCK_SESSIONS } from "./context-data";
import { useShell } from "./shell-context";

function Section({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-xs px-sm pb-xs pt-md first:pt-0">
        <Icon className="size-3.5 text-muted-foreground" aria-hidden="true" />
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      </div>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

// Mobile: school/branch/session switching moves here instead of living as
// three separate header pills — tapping the mobile header's title area opens this.
export function MobileContextSheet() {
  const {
    mobileContextSheetOpen,
    setMobileContextSheetOpen,
    activeSchoolId,
    setActiveSchoolId,
    activeBranchId,
    setActiveBranchId,
    activeSession,
    setActiveSession,
  } = useShell();
  const reduceMotion = useReducedMotion();

  return (
    <Dialog.Root open={mobileContextSheetOpen} onOpenChange={setMobileContextSheetOpen}>
      <AnimatePresence>
        {mobileContextSheetOpen && (
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
                className="fixed inset-x-0 bottom-0 z-50 flex max-h-[75vh] flex-col rounded-t-2xl bg-surface pb-[calc(env(safe-area-inset-bottom)_+_0.5rem)] shadow-floating md:hidden"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeOut" }}
              >
                <div className="mx-auto mt-sm h-1 w-10 shrink-0 rounded-pill bg-border" aria-hidden="true" />
                <div className="flex shrink-0 items-center justify-between px-md py-sm">
                  <Dialog.Title className="text-sm font-semibold text-foreground">Switch context</Dialog.Title>
                  <Dialog.Close
                    className="flex size-9 items-center justify-center rounded-pill text-muted-foreground transition-colors hover:bg-surface-secondary"
                    aria-label="Close"
                  >
                    <X className="size-[18px]" aria-hidden="true" />
                  </Dialog.Close>
                </div>
                <Dialog.Description className="sr-only">
                  Switch the active school, branch, and academic session.
                </Dialog.Description>

                <div className="flex-1 overflow-y-auto px-sm pb-sm">
                  <Section icon={School} label="School">
                    {MOCK_SCHOOLS.map((school) => (
                      <button
                        key={school.id}
                        type="button"
                        onClick={() => setActiveSchoolId(school.id)}
                        className="flex min-h-11 items-center gap-sm rounded-md px-sm text-left text-sm text-foreground outline-none transition-colors hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className="flex-1 truncate">{school.name}</span>
                        {school.id === activeSchoolId && (
                          <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />
                        )}
                      </button>
                    ))}
                  </Section>

                  <Section icon={Building2} label="Branch">
                    {MOCK_BRANCHES.map((branch) => (
                      <button
                        key={branch.id}
                        type="button"
                        onClick={() => setActiveBranchId(branch.id)}
                        className="flex min-h-11 items-center gap-sm rounded-md px-sm text-left text-sm text-foreground outline-none transition-colors hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className="flex-1 truncate">{branch.name}</span>
                        {branch.id === activeBranchId && (
                          <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />
                        )}
                      </button>
                    ))}
                  </Section>

                  <Section icon={Calendar} label="Academic session">
                    {MOCK_SESSIONS.map((session) => (
                      <button
                        key={session}
                        type="button"
                        onClick={() => setActiveSession(session)}
                        className="flex min-h-11 items-center gap-sm rounded-md px-sm text-left text-sm text-foreground outline-none transition-colors hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className="flex-1 truncate">{session}</span>
                        {session === activeSession && (
                          <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />
                        )}
                      </button>
                    ))}
                  </Section>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
