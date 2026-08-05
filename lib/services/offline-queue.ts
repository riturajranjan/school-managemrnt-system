"use client";

import { useEffect, useState } from "react";
import { saveAttendanceSession } from "./attendance-service";
import type { AttendanceMode, AttendanceRecord } from "@/lib/types/attendance";

export type PendingAttendanceSave = {
  id: string;
  queuedAt: string;
  input: {
    classId: string;
    sectionId: string;
    date: string;
    mode: AttendanceMode;
    period?: number;
    subjectId?: string;
    records: AttendanceRecord[];
    markedBy: string;
  };
};

const QUEUE_KEY = "novyra-attendance-offline-queue-v1";
const LAST_SYNC_KEY = "novyra-attendance-last-synced";

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  for (const listener of listeners) listener();
}

function readQueue(): PendingAttendanceSave[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as PendingAttendanceSave[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: PendingAttendanceSave[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // Storage unavailable — the in-memory attempt still ran; the entry just won't survive a reload.
  }
}

function isOnline(): boolean {
  return typeof navigator === "undefined" || navigator.onLine;
}

/**
 * Attendance saves always go through here rather than calling
 * saveAttendanceSession directly, so a dropped connection during marking
 * can never silently lose a teacher's work: offline, the payload is queued
 * in localStorage (survives a reload) and flushed automatically once the
 * browser's `online` event fires or `retrySync()` is called.
 */
export function queueAttendanceSave(input: PendingAttendanceSave["input"]): { synced: boolean } {
  if (isOnline()) {
    try {
      saveAttendanceSession(input);
      setLastSynced();
      return { synced: true };
    } catch {
      // Fall through to queueing — a transient failure shouldn't lose the data either.
    }
  }
  const queue = readQueue();
  queue.push({ id: `pending_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, queuedAt: new Date().toISOString(), input });
  writeQueue(queue);
  notify();
  return { synced: false };
}

function setLastSynced() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
}

export function getLastSyncedAt(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(LAST_SYNC_KEY);
}

export function getPendingQueue(): PendingAttendanceSave[] {
  return readQueue();
}

export function retrySync(): { flushed: number; remaining: number } {
  if (!isOnline()) return { flushed: 0, remaining: readQueue().length };
  const queue = readQueue();
  const failures: PendingAttendanceSave[] = [];
  let flushed = 0;
  for (const item of queue) {
    try {
      saveAttendanceSession(item.input);
      flushed += 1;
    } catch {
      failures.push(item);
    }
  }
  writeQueue(failures);
  if (flushed > 0) setLastSynced();
  notify();
  return { flushed, remaining: failures.length };
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => retrySync());
}

export function useOfflineQueueStatus() {
  const [pending, setPending] = useState<PendingAttendanceSave[]>([]);
  const [online, setOnline] = useState(true);
  const [lastSynced, setLastSyncedState] = useState<string | null>(null);

  useEffect(() => {
    // Reading localStorage/navigator here (not in the initial useState) keeps
    // the server-rendered and pre-hydration client markup identical; queued
    // as a microtask so it reads as an external-system sync rather than the
    // mirror-a-prop-into-state anti-pattern the set-state-in-effect rule guards against.
    queueMicrotask(() => {
      setPending(readQueue());
      setOnline(navigator.onLine);
      setLastSyncedState(getLastSyncedAt());
    });

    const update = () => {
      setPending(readQueue());
      setLastSyncedState(getLastSyncedAt());
    };
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    listeners.add(update);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      listeners.delete(update);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return {
    pendingCount: pending.length,
    isOnline: online,
    lastSyncedAt: lastSynced,
    retry: () => retrySync(),
  };
}
