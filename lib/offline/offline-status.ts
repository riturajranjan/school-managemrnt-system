"use client";

import { useCallback, useEffect, useState } from "react";

/** Offline support for driver/attendant flows.
 *
 * This app's "backend" is the local, persisted client store (see
 * lib/data/store.ts) — every mutation already writes straight to
 * localStorage with no network hop that could fail mid-flight. So the thing
 * that can genuinely go wrong when a driver/attendant loses signal isn't
 * data loss (the write already succeeded locally) — it's the *driver not
 * knowing* whether their action reached the server in a real deployment.
 *
 * This module tracks connectivity and a "pending sync" list purely for that
 * visibility: actions taken while offline are appended here so the UI can
 * show "N action(s) waiting to sync," and the list clears automatically the
 * moment the browser's `online` event fires — standing in for a real sync
 * confirmation the same way simulateNextGpsTick() stands in for a hardware
 * GPS feed. */

export type PendingSyncEntry = { id: string; label: string; queuedAt: string };

const STORAGE_KEY = "novyra-transport-pending-sync";
const CHANGE_EVENT = "novyra-pending-sync-changed";

function readPending(): PendingSyncEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PendingSyncEntry[]) : [];
  } catch {
    return [];
  }
}

function writePending(entries: PendingSyncEntry[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Records that an action was taken while offline. The mutation itself has
 * already been applied to the local store by the caller — this only tracks
 * that a sync confirmation is still owed once connectivity returns. */
export function trackPendingSync(label: string) {
  writePending([...readPending(), { id: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, label, queuedAt: new Date().toISOString() }]);
}

function clearPendingSync() {
  writePending([]);
}

function currentlyOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

export function useIsOnline(): boolean {
  const [online, setOnline] = useState(currentlyOnline);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return online;
}

/** Clears on reconnect from the native `online` event itself, not from a
 * derived effect watching the `online` boolean — the list must clear exactly
 * once per reconnect, as a direct response to the browser event. */
export function usePendingSync(): PendingSyncEntry[] {
  const [pending, setPending] = useState<PendingSyncEntry[]>(readPending);
  const refresh = useCallback(() => setPending(readPending()), []);

  useEffect(() => {
    const handleReconnect = () => {
      clearPendingSync();
      refresh();
    };
    window.addEventListener(CHANGE_EVENT, refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("online", handleReconnect);
    return () => {
      window.removeEventListener(CHANGE_EVENT, refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("online", handleReconnect);
    };
  }, [refresh]);

  return pending;
}
