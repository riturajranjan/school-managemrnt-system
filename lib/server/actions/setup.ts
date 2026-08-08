"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { APIError } from "better-auth/api";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/server/context";
import { recordAudit } from "@/lib/server/audit";
import { deriveContextChoices, patchStoredContext, resolvePostLoginDestination } from "@/lib/server/auth/onboarding";

// ---------------------------------------------------------------------------
// Pre-dashboard SETUP actions. Each validates the current session server-side,
// mutates real onboarding state, then hands off to the central resolver to
// decide the next destination — redirect logic is never duplicated here.
// ---------------------------------------------------------------------------

export type SetupState = { error?: string } | undefined;

// --- Profile confirmation (first-login) ------------------------------------
const profileSchema = z.object({ name: z.string().trim().min(2, "Enter your full name.").max(120) });

export async function completeProfileAction(_prev: SetupState, formData: FormData): Promise<SetupState> {
  const user = await requireUser();
  const parsed = profileSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid name." };

  await prisma.user.update({
    where: { id: user.id },
    data: { name: parsed.data.name, profileCompletedAt: new Date() },
  });
  await recordAudit({ actorUserId: user.id, action: "auth.profile.completed", entityType: "User" }).catch(() => {});

  redirect(await resolvePostLoginDestination(user.id));
}

// --- Password setup (invited users) ----------------------------------------
const passwordSchema = z
  .object({
    password: z.string().min(8, "Use at least 8 characters."),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "Passwords do not match.", path: ["confirm"] });

export async function setupPasswordAction(_prev: SetupState, formData: FormData): Promise<SetupState> {
  const user = await requireUser();
  const parsed = passwordSchema.safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid password." };

  try {
    await auth.api.setPassword({ body: { newPassword: parsed.data.password }, headers: await headers() });
  } catch (err) {
    if (!(err instanceof APIError)) throw err;
    return { error: "Could not set your password. Please try again." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordSetupRequired: false, status: "ACTIVE" },
  });
  await recordAudit({ actorUserId: user.id, action: "auth.password.setup", entityType: "User" }).catch(() => {});

  redirect(await resolvePostLoginDestination(user.id));
}

// --- Context selectors ------------------------------------------------------
// Used from plain <form> submit buttons (formAction), so these return void and
// redirect. An invalid selection (never possible from the rendered choices, but
// checked anyway to reject tampering) bounces to access-denied.
async function choicesOrDeny() {
  const user = await requireUser();
  const choices = await deriveContextChoices(user.id);
  if (!choices) redirect("/access-denied");
  return { user, choices: choices! };
}

export async function selectSchoolAction(formData: FormData): Promise<void> {
  const { user, choices } = await choicesOrDeny();
  const schoolId = String(formData.get("schoolId") ?? "");
  if (!choices.schools.some((s) => s.id === schoolId)) redirect("/access-denied");
  await patchStoredContext(user.id, { tenantId: choices.tenantId, schoolId });
  await recordAudit({ actorUserId: user.id, tenantId: choices.tenantId, action: "auth.context.school", entityType: "School", entityId: schoolId }).catch(() => {});
  redirect(await resolvePostLoginDestination(user.id));
}

export async function selectRoleAction(formData: FormData): Promise<void> {
  const { user, choices } = await choicesOrDeny();
  const roleId = String(formData.get("roleId") ?? "");
  if (!choices.roles.some((r) => r.roleId === roleId)) redirect("/access-denied");
  await patchStoredContext(user.id, { tenantId: choices.tenantId, activeRoleId: roleId });
  await recordAudit({ actorUserId: user.id, tenantId: choices.tenantId, action: "auth.context.role", entityType: "Role", entityId: roleId }).catch(() => {});
  redirect(await resolvePostLoginDestination(user.id));
}

export async function selectBranchAction(formData: FormData): Promise<void> {
  const { user, choices } = await choicesOrDeny();
  const branchId = String(formData.get("branchId") ?? "");
  if (!choices.branches.some((b) => b.id === branchId)) redirect("/access-denied");
  await patchStoredContext(user.id, { tenantId: choices.tenantId, branchId });
  await recordAudit({ actorUserId: user.id, tenantId: choices.tenantId, action: "auth.context.branch", entityType: "Branch", entityId: branchId }).catch(() => {});
  redirect(await resolvePostLoginDestination(user.id));
}
