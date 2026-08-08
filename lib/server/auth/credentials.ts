import "server-only";
import { APIError } from "better-auth/api";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { recordAudit } from "@/lib/server/audit";
import { safeNext } from "./safe-redirect";
import { checkLoginRate, registerFailure, registerSuccess } from "./rate-limit";

export const credentialsLoginSchema = z.object({
  identifier: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(256),
  next: z.string().optional(),
});

export type LoginErrorCode =
  | "INVALID_CREDENTIALS"
  | "ACCOUNT_RESTRICTED"
  | "RATE_LIMITED"
  | "DATABASE_UNAVAILABLE"
  | "AUTH_CONFIGURATION_ERROR"
  | "UNKNOWN_ERROR";

export type AuthenticateCredentialsInput = z.input<typeof credentialsLoginSchema> & {
  headers: Headers;
  ipAddress?: string | null;
};

export type AuthenticateCredentialsResult =
  | { success: true; userId: string; redirectTo: string }
  | { success: false; errorCode: LoginErrorCode; retryAfterSec?: number };

export const LOGIN_ERROR_COPY: Record<LoginErrorCode, string> = {
  INVALID_CREDENTIALS: "Invalid email or password.",
  ACCOUNT_RESTRICTED: "This account cannot sign in. Contact your administrator.",
  RATE_LIMITED: "Too many attempts. Try again later.",
  DATABASE_UNAVAILABLE: "Sign-in is temporarily unavailable. Try again shortly.",
  AUTH_CONFIGURATION_ERROR: "Sign-in is not configured correctly.",
  UNKNOWN_ERROR: "Sign-in failed. Try again shortly.",
};

const ACTIVE_STATUS = "ACTIVE";

function isDatabaseUnavailable(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  return e.code === "P1001" || /database|connection|can't reach/i.test(e.message ?? "");
}

export async function resolveSimplePostLoginDestination(userId: string): Promise<string> {
  const platformAdmin = await prisma.platformAdmin.findUnique({
    where: { userId },
    select: { status: true },
  });
  if (platformAdmin?.status === "ACTIVE") return "/super-admin/dashboard";

  const membership = await prisma.tenantMembership.findFirst({
    where: { userId, status: "ACTIVE" },
    include: { roleAssignments: { include: { role: { select: { key: true } } } } },
    orderBy: { createdAt: "asc" },
  });

  const roleKey = membership?.roleAssignments[0]?.role.key;
  if (roleKey === "TEACHER") return "/teacher/my-day";
  if (roleKey === "LIBRARIAN") return "/library";
  if (roleKey === "TRANSPORT_MANAGER") return "/transport";
  if (roleKey === "HR_ADMIN") return "/hr";
  if (roleKey === "ACCOUNTANT") return "/fees";
  return "/";
}

export async function authenticateCredentials(input: AuthenticateCredentialsInput): Promise<AuthenticateCredentialsResult> {
  const parsed = credentialsLoginSchema.safeParse(input);
  if (!parsed.success) return { success: false, errorCode: "INVALID_CREDENTIALS" };

  const { identifier: email, password, next } = parsed.data;
  const rateKey = `${input.ipAddress ?? "noip"}:${email}`;
  const rate = checkLoginRate(rateKey);
  if (!rate.allowed) return { success: false, errorCode: "RATE_LIMITED", retryAfterSec: rate.retryAfterSec };

  let userId: string | null = null;
  try {
    const res = await auth.api.signInEmail({ body: { email, password }, headers: input.headers });
    userId = res?.user?.id ?? null;
  } catch (err) {
    if (err instanceof APIError || (err as { name?: string }).name === "APIError") {
      registerFailure(rateKey);
      await recordAudit({ action: "auth.login.failure", entityType: "User", metadata: { email }, ipAddress: input.ipAddress }).catch(() => {});
      return { success: false, errorCode: "INVALID_CREDENTIALS" };
    }
    if (isDatabaseUnavailable(err)) return { success: false, errorCode: "DATABASE_UNAVAILABLE" };
    return { success: false, errorCode: "UNKNOWN_ERROR" };
  }

  if (!userId) {
    registerFailure(rateKey);
    await recordAudit({ action: "auth.login.failure", entityType: "User", metadata: { email }, ipAddress: input.ipAddress }).catch(() => {});
    return { success: false, errorCode: "INVALID_CREDENTIALS" };
  }

  let user: { status: string } | null;
  try {
    user = await prisma.user.findUnique({ where: { id: userId }, select: { status: true } });
  } catch {
    await prisma.session.deleteMany({ where: { userId } }).catch(() => {});
    return { success: false, errorCode: "DATABASE_UNAVAILABLE" };
  }

  if (!user || user.status !== ACTIVE_STATUS) {
    await prisma.session.deleteMany({ where: { userId } }).catch(() => {});
    registerFailure(rateKey);
    await recordAudit({
      actorUserId: userId,
      action: "auth.login.blocked",
      entityType: "User",
      metadata: { status: user?.status ?? "missing" },
      ipAddress: input.ipAddress,
    }).catch(() => {});
    return { success: false, errorCode: "ACCOUNT_RESTRICTED" };
  }

  registerSuccess(rateKey);
  await prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } }).catch(() => {});
  await recordAudit({ actorUserId: userId, action: "auth.login.success", entityType: "User", ipAddress: input.ipAddress }).catch(() => {});

  const fallback = await resolveSimplePostLoginDestination(userId);
  return { success: true, userId, redirectTo: safeNext(next, fallback) };
}
