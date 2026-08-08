/** Formats a mock minor-unit (paise) amount as INR. Frontend display only. */
export function formatMinor(minor: number, opts?: { compact?: boolean }): string {
  const major = minor / 100;
  if (opts?.compact) {
    if (major >= 10000000) return `₹${(major / 10000000).toFixed(2)}Cr`;
    if (major >= 100000) return `₹${(major / 100000).toFixed(2)}L`;
    if (major >= 1000) return `₹${(major / 1000).toFixed(1)}k`;
  }
  return `₹${major.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}
