"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { APIError } from "better-auth/api";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { recordAudit } from "@/lib/server/audit";
import { requireUser } from "@/lib/server/context";

// ---------------------------------------------------------------------------
// Password recovery + change Server Actions. Token minting/expiry/one-time-use
// are handled by Better Auth; these wrappers add validation, a NON-enumerating
// response for the request step, and audit events.
// ---------------------------------------------------------------------------

export type PasswordState = { error?: string; sent?: boolean } | undefined;

// --- Forgot password: request a reset link ---------------------------------
const requestSchema = z.object({ email: z.string().trim().min(1) });

export async function requestPasswordResetAction(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const parsed = requestSchema.safeParse({ email: formData.get("email") });
  // Always report the same generic outcome — never reveal whether the account
  // exists. Only attempt the request for well-formed emails.
  const email = parsed.success ? parsed.data.email.toLowerCase() : "";
  if (email && z.email().safeParse(email).success) {
    try {
      await auth.api.requestPasswordReset({ body: { email, redirectTo: "/reset-password" } });
      await recordAudit({ action: "auth.password.reset_requested", entityType: "User", metadata: { email } }).catch(() => {});
    } catch (err) {
      if (!(err instanceof APIError)) throw err;
      // Swallow — do not leak provider/account state to the client.
    }
  }
  return { sent: true };
}

// --- Reset password with token ---------------------------------------------
const resetSchema = z
  .object({
    token: z.string().min(1, "This reset link is invalid or has expired."),
    password: z.string().min(8, "Use at least 8 characters."),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "Passwords do not match.", path: ["confirm"] });

export async function resetPasswordAction(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const parsed = resetSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid request." };

  try {
    await auth.api.resetPassword({ body: { newPassword: parsed.data.password, token: parsed.data.token } });
  } catch (err) {
    if (!(err instanceof APIError)) throw err;
    return { error: "This reset link is invalid or has expired. Request a new one." };
  }

  await recordAudit({ action: "auth.password.reset", entityType: "User" }).catch(() => {});
  redirect("/login?reset=1");
}

// --- Authenticated change password -----------------------------------------
const changeSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    password: z.string().min(8, "Use at least 8 characters."),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "Passwords do not match.", path: ["confirm"] });

export async function changePasswordAction(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const user = await requireUser();
  const parsed = changeSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid request." };

  try {
    await auth.api.changePassword({
      body: { currentPassword: parsed.data.currentPassword, newPassword: parsed.data.password, revokeOtherSessions: true },
      headers: await headers(),
    });
  } catch (err) {
    if (!(err instanceof APIError)) throw err;
    return { error: "Current password is incorrect." };
  }

  await recordAudit({ actorUserId: user.id, action: "auth.password.changed", entityType: "User" }).catch(() => {});
  return { sent: true };
}
