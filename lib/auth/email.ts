import "server-only";

// ---------------------------------------------------------------------------
// Transactional auth email — ADAPTER placeholder. No external provider is wired
// in this phase (Step 34/38), so in development we log the action link to the
// server console instead of sending mail. Swap `deliverAuthEmail` for a real
// provider (Resend / SES / Postmark) when transactional email lands; the call
// sites (password reset, verification, invites) do not change.
//
// NEVER log this in production — a reset/verify URL contains a valid token.
// ---------------------------------------------------------------------------

export type AuthEmailKind = "reset" | "verify" | "invite";

export async function deliverAuthEmail(input: { to: string; subject: string; kind: AuthEmailKind; url: string }): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    // Intentionally a no-op stub until a provider is configured. Do not print
    // tokens. A production deployment MUST replace this before enabling these
    // flows for real users.
    console.warn(`[auth-email] No email provider configured — ${input.kind} email to ${input.to} was NOT sent.`);
    return;
  }
  // Development: surface the link so the flow is testable end-to-end.
  console.info(`\n[auth-email:dev] ${input.subject}\n  to:   ${input.to}\n  kind: ${input.kind}\n  link: ${input.url}\n`);
}
