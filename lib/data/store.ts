import type { AdmissionApplication } from "@/lib/types/admissions";
import type { Guardian, ParentAccount, Student, StudentGuardianLink } from "@/lib/types/students";
import type { ImportJob } from "@/lib/types/import";
import type { SavedView } from "@/lib/types/views";
import { generateAdmissionApplications } from "./seed/admissions";
import { generateStudents } from "./seed/students";

export type Db = {
  applications: AdmissionApplication[];
  students: Student[];
  guardians: Guardian[];
  studentGuardianLinks: StudentGuardianLink[];
  parentAccounts: ParentAccount[];
  importJobs: ImportJob[];
  savedViews: SavedView[];
};

const STORAGE_KEY = "novyra-sis-store-v1";

function buildSeedDb(): Db {
  const applications = generateAdmissionApplications();
  const { students, guardians, studentGuardianLinks, parentAccounts } = generateStudents();
  return { applications, students, guardians, studentGuardianLinks, parentAccounts, importJobs: [], savedViews: [] };
}

// Seeded deterministically so the very first server-rendered HTML and the
// client's pre-hydration render are byte-identical — localStorage (which can
// differ from the seed) is only applied afterwards, via hydrateFromStorage(),
// so it lands as a normal post-mount state update rather than a hydration
// mismatch.
let state: Db = buildSeedDb();
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or unavailable (private browsing) — in-memory state still works for this session.
  }
}

export function getSnapshot(): Db {
  return state;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function hydrateFromStorage() {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Db;
    if (parsed && Array.isArray(parsed.applications) && Array.isArray(parsed.students)) {
      state = parsed;
      notify();
    }
  } catch {
    // Corrupt or incompatible snapshot — keep the freshly seeded in-memory state.
  }
}

export function resetDemoData() {
  state = buildSeedDb();
  persist();
  notify();
}

/** Applies an immutable update to the store and notifies + persists. Internal — services call this, UI never should. */
export function setState(updater: (draft: Db) => Db) {
  state = updater(state);
  persist();
  notify();
}
