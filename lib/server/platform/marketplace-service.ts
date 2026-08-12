// Marketplace service (Super Admin Phase SA-4M).
//
// A MarketplaceApp is an optional/external integration a school can install.
// HONEST BOUNDARY: this phase persists installation INTENT + enabled/disabled
// status + NON-SECRET configuration metadata only. It NEVER fakes OAuth / token
// exchange / webhook registration / provider connectivity, and NEVER stores or
// returns secrets. The tenant is always derived from the target School.
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { MarketplaceAppDto, SchoolMarketplaceInstallationDto } from "@/lib/api/contracts";
import { resolveSchoolTarget } from "./school-target";

export type MarketplaceActor = { id: string; name: string | null };

const STATUS_TO_DB = { draft: "DRAFT", active: "ACTIVE", archived: "ARCHIVED" } as const;

export const createSchema = z.object({
  code: z.string().trim().min(1).max(60).regex(/^[A-Za-z0-9_-]+$/, "Code: letters, digits, _ or - only"),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  category: z.string().trim().min(1).max(60),
  providerName: z.string().trim().max(120).optional(),
  documentationUrl: z.string().trim().url().max(2048).optional(),
});

export const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  category: z.string().trim().min(1).max(60).optional(),
  providerName: z.string().trim().max(120).nullable().optional(),
  documentationUrl: z.string().trim().url().max(2048).nullable().optional(),
});

// Installation configuration is NON-SECRET metadata only. Reject obvious secret
// keys defensively so a caller can never smuggle credentials into the store.
const SECRET_KEY_RE = /(secret|token|password|api[_-]?key|client[_-]?secret|private[_-]?key|credential)/i;

type AppRow = {
  id: string; code: string; name: string; description: string | null; category: string;
  providerName: string | null; status: string; documentationUrl: string | null;
  createdAt: Date; updatedAt: Date; _count?: { installations: number };
};

function toDto(a: AppRow, installedSchoolCount?: number): MarketplaceAppDto {
  return {
    id: a.id, code: a.code, name: a.name, description: a.description, category: a.category,
    providerName: a.providerName, status: a.status.toLowerCase(), documentationUrl: a.documentationUrl,
    installedSchoolCount: installedSchoolCount ?? a._count?.installations ?? 0,
    // Honest external boundary: no live provider connection exists in this phase.
    connectionConfigured: false,
    createdAt: a.createdAt.toISOString(), updatedAt: a.updatedAt.toISOString(),
  };
}

function auditScope(actor: MarketplaceActor, tenantId: string, schoolId: string | null): OrgScope {
  return { tenantId, schoolId: schoolId ?? "", branchId: null, academicSessionId: null, actor: { id: actor.id, name: actor.name } };
}

// ── Catalog ────────────────────────────────────────────────────────────────

/** List the marketplace catalog with the count of schools with an INSTALLED app. */
export async function listApps(category?: string): Promise<MarketplaceAppDto[]> {
  const rows = await prisma.marketplaceApp.findMany({
    where: category ? { category } : undefined,
    orderBy: [{ status: "asc" }, { name: "asc" }],
    include: { _count: { select: { installations: { where: { status: "INSTALLED" } } } } },
  });
  return rows.map((r) => toDto(r));
}

export async function getApp(id: string): Promise<MarketplaceAppDto> {
  const a = await prisma.marketplaceApp.findUnique({ where: { id }, include: { _count: { select: { installations: { where: { status: "INSTALLED" } } } } } });
  if (!a) throw new HttpError("NOT_FOUND", "Marketplace app not found");
  return toDto(a);
}

export async function createApp(actor: MarketplaceActor, raw: unknown): Promise<MarketplaceAppDto> {
  const input = parseInput(createSchema, raw);
  const clash = await prisma.marketplaceApp.findUnique({ where: { code: input.code }, select: { id: true } });
  if (clash) throw new HttpError("CONFLICT", "A marketplace app with this code already exists");
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.marketplaceApp.create({
      data: {
        code: input.code, name: input.name, description: input.description ?? null, category: input.category,
        providerName: input.providerName ?? null, documentationUrl: input.documentationUrl ?? null, status: "ACTIVE",
      },
    });
    await recordAudit(tx, auditScope(actor, "", null), "MARKETPLACE_APP_CREATED", "MarketplaceApp", row.id, { code: row.code });
    return row;
  });
  return toDto({ ...created, _count: { installations: 0 } });
}

export async function updateApp(actor: MarketplaceActor, id: string, raw: unknown): Promise<MarketplaceAppDto> {
  const input = parseInput(updateSchema, raw);
  const existing = await prisma.marketplaceApp.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new HttpError("NOT_FOUND", "Marketplace app not found");
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.marketplaceApp.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description === undefined ? undefined : input.description,
        category: input.category,
        providerName: input.providerName === undefined ? undefined : input.providerName,
        documentationUrl: input.documentationUrl === undefined ? undefined : input.documentationUrl,
      },
      include: { _count: { select: { installations: { where: { status: "INSTALLED" } } } } },
    });
    await recordAudit(tx, auditScope(actor, "", null), "MARKETPLACE_APP_UPDATED", "MarketplaceApp", id);
    return row;
  });
  return toDto(updated);
}

export async function setAppStatus(actor: MarketplaceActor, id: string, status: "draft" | "active" | "archived"): Promise<MarketplaceAppDto> {
  const next = STATUS_TO_DB[status];
  const existing = await prisma.marketplaceApp.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!existing) throw new HttpError("NOT_FOUND", "Marketplace app not found");
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.marketplaceApp.update({
      where: { id },
      data: { status: next, archivedAt: next === "ARCHIVED" ? new Date() : null },
      include: { _count: { select: { installations: { where: { status: "INSTALLED" } } } } },
    });
    await recordAudit(tx, auditScope(actor, "", null), "MARKETPLACE_APP_STATUS_CHANGED", "MarketplaceApp", id, { from: existing.status, to: next });
    return row;
  });
  return toDto(updated);
}

// ── School installation ──────────────────────────────────────────────────────

type InstallRow = {
  id: string; status: string; installedAt: Date; disabledAt: Date | null; configuration: unknown;
  app: { id: string; code: string; name: string; category: string; providerName: string | null };
};

function installDto(schoolId: string, i: InstallRow): SchoolMarketplaceInstallationDto {
  return {
    id: i.id, schoolId,
    app: { id: i.app.id, code: i.app.code, name: i.app.name, category: i.app.category, providerName: i.app.providerName },
    status: i.status.toLowerCase(),
    installedAt: i.installedAt.toISOString(),
    disabledAt: i.disabledAt ? i.disabledAt.toISOString() : null,
    // Non-secret metadata only; secrets are never stored, so never returned.
    configuration: (i.configuration ?? null) as Record<string, unknown> | null,
    connectionConfigured: false,
  };
}

const installSelect = {
  id: true, status: true, installedAt: true, disabledAt: true, configuration: true,
  app: { select: { id: true, code: true, name: true, category: true, providerName: true } },
} as const;

/** A school's installations (INSTALLED first). */
export async function listSchoolInstalls(schoolId: string): Promise<SchoolMarketplaceInstallationDto[]> {
  await resolveSchoolTarget(schoolId);
  const rows = await prisma.schoolMarketplaceInstallation.findMany({ where: { schoolId }, select: installSelect, orderBy: [{ status: "asc" }, { installedAt: "desc" }] });
  return rows.map((r) => installDto(schoolId, r));
}

function assertNonSecretConfig(config: Record<string, unknown> | undefined): void {
  if (!config) return;
  for (const key of Object.keys(config)) {
    if (SECRET_KEY_RE.test(key)) throw new HttpError("VALIDATION_ERROR", `Configuration must not contain secrets ("${key}")`);
  }
}

/** Install (or re-enable) an app for a school. Idempotent per (school, app). */
export async function installApp(actor: MarketplaceActor, schoolId: string, appId: string, config?: Record<string, unknown>): Promise<SchoolMarketplaceInstallationDto> {
  const target = await resolveSchoolTarget(schoolId);
  const app = await prisma.marketplaceApp.findUnique({ where: { id: appId }, select: { id: true, status: true } });
  if (!app) throw new HttpError("NOT_FOUND", "Marketplace app not found");
  if (app.status !== "ACTIVE") throw new HttpError("CONFLICT", "Only an ACTIVE app can be installed");
  assertNonSecretConfig(config);

  const configJson = config as Prisma.InputJsonValue | undefined;
  const row = await prisma.$transaction(async (tx) => {
    const saved = await tx.schoolMarketplaceInstallation.upsert({
      where: { schoolId_appId: { schoolId, appId } },
      update: { status: "INSTALLED", disabledAt: null, installedAt: new Date(), ...(configJson !== undefined ? { configuration: configJson } : {}) },
      create: { tenantId: target.tenantId, schoolId, appId, status: "INSTALLED", ...(configJson !== undefined ? { configuration: configJson } : {}) },
      select: installSelect,
    });
    await recordAudit(tx, auditScope(actor, target.tenantId, schoolId), "MARKETPLACE_APP_INSTALLED", "SchoolMarketplaceInstallation", saved.id, { appId });
    return saved;
  });
  return installDto(schoolId, row);
}

/** Disable a school's installation (status DISABLED). */
export async function disableInstall(actor: MarketplaceActor, schoolId: string, appId: string): Promise<SchoolMarketplaceInstallationDto> {
  const target = await resolveSchoolTarget(schoolId);
  const existing = await prisma.schoolMarketplaceInstallation.findUnique({ where: { schoolId_appId: { schoolId, appId } }, select: { id: true } });
  if (!existing) throw new HttpError("NOT_FOUND", "Installation not found");
  const row = await prisma.$transaction(async (tx) => {
    const saved = await tx.schoolMarketplaceInstallation.update({ where: { id: existing.id }, data: { status: "DISABLED", disabledAt: new Date() }, select: installSelect });
    await recordAudit(tx, auditScope(actor, target.tenantId, schoolId), "MARKETPLACE_APP_DISABLED", "SchoolMarketplaceInstallation", existing.id, { appId });
    return saved;
  });
  return installDto(schoolId, row);
}

/** Is an app INSTALLED (enabled) for a school? Enforcement primitive. */
export async function isAppInstalled(schoolId: string, appCode: string): Promise<boolean> {
  const row = await prisma.schoolMarketplaceInstallation.findFirst({ where: { schoolId, status: "INSTALLED", app: { code: appCode } }, select: { id: true } });
  return row != null;
}
