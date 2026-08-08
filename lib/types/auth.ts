// ===========================================================================
// Auth-adjacent UI helpers + mock data for DEFERRED features only.
//
// The authoritative authentication system is now real and server-backed (Better
// Auth + Prisma + server session; see lib/auth/* and lib/server/auth/*). The
// former mock login/session/role/school/branch data has been REMOVED — nothing
// here grants access or determines identity.
//
// What remains is UI-only sample data for screens whose backend is NOT in scope
// this phase (2FA, trusted devices, login history, recovery codes, account
// invitations) plus a pure password-strength helper. These never gate access.
// ===========================================================================

export type MockLoginAttempt = { at: string; device: string; location: string; result: "success" | "failed" };

export type MockInvitation = {
  id: string;
  schoolName: string;
  invitedBy: string;
  role: string;
  branch: string;
  email: string;
  expiresAt: string;
};

export type MockTrustedDevice = {
  id: string;
  device: string;
  browser: string;
  location: string;
  lastActive: string;
  current: boolean;
  trusted: boolean;
};

export type MockSecurityPreference = { key: string; label: string; description: string; enabled: boolean; backendRequired: boolean };

export const MOCK_TRUSTED_DEVICES: MockTrustedDevice[] = [
  { id: "d1", device: "MacBook Pro", browser: "Chrome 128", location: "Patna, India", lastActive: "Active now", current: true, trusted: true },
  { id: "d2", device: "iPhone 15", browser: "Safari", location: "Patna, India", lastActive: "3 hours ago", current: false, trusted: true },
  { id: "d3", device: "Windows PC", browser: "Edge", location: "Delhi, India", lastActive: "2 days ago", current: false, trusted: false },
];

export const MOCK_LOGIN_HISTORY: MockLoginAttempt[] = [
  { at: "Today, 09:12", device: "MacBook Pro · Chrome", location: "Patna, India", result: "success" },
  { at: "Yesterday, 18:44", device: "iPhone 15 · Safari", location: "Patna, India", result: "success" },
  { at: "2 days ago, 08:03", device: "Windows PC · Edge", location: "Delhi, India", result: "failed" },
];

export const MOCK_RECOVERY_CODES = ["4F9K-2QX7", "7HD3-8LM1", "P2WN-6RT9", "5ZBQ-1VK4", "9CJ8-3XPD", "K7MR-4NQ2", "T3YL-8WF6", "1DVX-5GH0"];

export const MOCK_SECURITY_PREFS: MockSecurityPreference[] = [
  { key: "2fa", label: "Two-step verification", description: "Require a second factor at sign-in.", enabled: false, backendRequired: true },
  { key: "login-alerts", label: "New sign-in alerts", description: "Notify me of sign-ins from new devices.", enabled: true, backendRequired: true },
  { key: "trusted-only", label: "Trusted devices only", description: "Block sign-in from unrecognised devices.", enabled: false, backendRequired: true },
];

// Password strength (pure UI helper — no bearing on authentication).
export type PasswordStrength = "weak" | "fair" | "good" | "strong";

export function scorePassword(pw: string): { strength: PasswordStrength; checks: { label: string; ok: boolean }[]; score: number } {
  const checks = [
    { label: "At least 8 characters", ok: pw.length >= 8 },
    { label: "A lowercase letter", ok: /[a-z]/.test(pw) },
    { label: "An uppercase letter", ok: /[A-Z]/.test(pw) },
    { label: "A number", ok: /\d/.test(pw) },
    { label: "A special character", ok: /[^A-Za-z0-9]/.test(pw) },
  ];
  const score = checks.filter((c) => c.ok).length;
  const strength: PasswordStrength = score <= 1 ? "weak" : score <= 3 ? "fair" : score === 4 ? "good" : "strong";
  return { strength, checks, score };
}
