// Client-side display labels for plan feature keys (Super Admin SA-4A). Feature
// entitlements are stored as opaque string keys on the Plan; this maps the known
// keys to human labels for the catalog UI. Unknown keys fall back to the raw key.
export const FEATURE_LABELS: Record<string, string> = {
  students: "Students",
  admissions: "Admissions",
  attendance: "Attendance",
  fees: "Fees",
  communication: "Communication",
  transport: "Transport",
  library: "Library",
  documents: "Documents",
  hr: "HR",
  inventory: "Inventory",
  assets: "Assets",
};

export const FEATURE_KEYS = Object.keys(FEATURE_LABELS);

export function featureLabel(key: string): string {
  return FEATURE_LABELS[key] ?? key;
}
