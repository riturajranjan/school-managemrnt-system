"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Eye, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type ImpersonationValue = { active: string | null; request: (schoolName: string) => void; confirm: () => void; exit: () => void; pending: string | null; cancel: () => void };
const Ctx = createContext<ImpersonationValue | null>(null);

/**
 * LEGACY MOCK — NOT AUTHORITY. Frontend-only impersonation simulation: it holds
 * a school NAME in React state (no localStorage, no server, no DB) and only shows
 * a confirmation modal + banner. It grants NO access, alters NO tenant/school
 * context, and NEVER influences API authorization. It reads no `db.saas` data and
 * does not persist across refresh. Real server-authoritative impersonation is a
 * dedicated future phase (SA-4K); until then a browser-selected tenant must never
 * become an authorization source.
 */
export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const reduce = useReducedMotion();

  const value = useMemo<ImpersonationValue>(() => ({
    active, pending,
    request: (name) => setPending(name),
    confirm: () => { setActive(pending); setPending(null); },
    cancel: () => setPending(null),
    exit: () => setActive(null),
  }), [active, pending]);

  return (
    <Ctx.Provider value={value}>
      {active && (
        <div role="status" className="mb-md flex flex-col gap-2 rounded-lg border border-warning/40 bg-warning/10 p-sm text-sm sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2 text-warning"><Eye className="size-4" /> Viewing as <span className="font-semibold text-foreground">{active}</span> · demo impersonation (no real access)</span>
          <Button size="sm" variant="outline" onClick={() => setActive(null)}><X className="size-3.5" /> Exit impersonation</Button>
        </div>
      )}
      {children}

      <AnimatePresence>
        {pending && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-md" onClick={() => setPending(null)}>
            <motion.div
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
              onClick={(e) => e.stopPropagation()}
              role="dialog" aria-modal="true" aria-label="Enter impersonation mode"
              className="w-full max-w-sm rounded-xl border border-border bg-surface p-md shadow-xl"
            >
              <div className="mb-sm flex items-center gap-2"><span className="flex size-9 items-center justify-center rounded-full bg-warning/15 text-warning"><Eye className="size-5" /></span><h2 className="text-sm font-semibold text-foreground">Enter demo impersonation?</h2></div>
              <p className="text-sm text-muted-foreground">You are about to view the platform as <span className="font-medium text-foreground">{pending}</span>. This is a frontend simulation only — no authentication or real access is granted.</p>
              <div className="mt-md flex justify-end gap-xs"><Button size="sm" variant="ghost" onClick={() => setPending(null)}>Cancel</Button><Button size="sm" onClick={() => { setActive(pending); setPending(null); }}>Enter demo mode</Button></div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Ctx.Provider>
  );
}

export function useImpersonation() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useImpersonation must be used within ImpersonationProvider");
  return ctx;
}
