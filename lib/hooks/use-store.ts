"use client";

import { useEffect, useSyncExternalStore } from "react";
import { getSnapshot, hydrateFromStorage, subscribe, type Db } from "@/lib/data/store";

let hydrated = false;

/** Reactive read of the whole SIS store. Prefer the domain-specific hooks (useAdmissions, useStudents, ...) in most components. */
export function useSisStore(): Db {
  const db = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    if (hydrated) return;
    hydrated = true;
    hydrateFromStorage();
  }, []);

  return db;
}
