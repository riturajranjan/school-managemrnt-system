// Platform settings service (Super Admin Phase SA-4N).
//
// A one-row singleton (fixed id "singleton") of SAFE, non-secret platform
// configuration. Secrets (SMTP/API/OAuth/payment) and infrastructure/runtime
// credentials are intentionally NOT modelled here — they never become editable
// generic DB settings. Read auto-creates defaults so the UI always has a row.
import { prisma } from "@/lib/db/prisma";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { PlatformSettingsDto } from "@/lib/api/contracts";
import { platformScope, type PlatformActor } from "./platform-audit";

const SINGLETON_ID = "singleton";

export const settingsUpdateSchema = z
  .object({
    platformName: z.string().trim().min(1).max(120),
    supportEmail: z.string().trim().email().max(320).nullable(),
    defaultLocale: z.string().trim().min(2).max(35),
    defaultTimezone: z.string().trim().min(1).max(64),
    defaultCurrency: z.string().trim().length(3),
    maintenanceMode: z.boolean(),
    maintenanceMessage: z.string().trim().max(500).nullable(),
    signupEnabled: z.boolean(),
    defaultTrialDays: z.number().int().min(0).max(365),
  })
  .partial();

type SettingsRow = {
  platformName: string; supportEmail: string | null; defaultLocale: string; defaultTimezone: string;
  defaultCurrency: string; maintenanceMode: boolean; maintenanceMessage: string | null;
  signupEnabled: boolean; defaultTrialDays: number; updatedAt: Date;
};

function toDto(r: SettingsRow): PlatformSettingsDto {
  return {
    platformName: r.platformName, supportEmail: r.supportEmail, defaultLocale: r.defaultLocale,
    defaultTimezone: r.defaultTimezone, defaultCurrency: r.defaultCurrency, maintenanceMode: r.maintenanceMode,
    maintenanceMessage: r.maintenanceMessage, signupEnabled: r.signupEnabled, defaultTrialDays: r.defaultTrialDays,
    updatedAt: r.updatedAt.toISOString(),
  };
}

const select = {
  platformName: true, supportEmail: true, defaultLocale: true, defaultTimezone: true, defaultCurrency: true,
  maintenanceMode: true, maintenanceMessage: true, signupEnabled: true, defaultTrialDays: true, updatedAt: true,
} as const;

/** Read the settings singleton, creating it with defaults on first access. */
export async function getSettings(): Promise<PlatformSettingsDto> {
  const row = await prisma.platformSetting.upsert({ where: { id: SINGLETON_ID }, update: {}, create: { id: SINGLETON_ID }, select });
  return toDto(row);
}

/** Update the settings singleton (partial). Writes a PLATFORM_SETTINGS_UPDATED audit. */
export async function updateSettings(actor: PlatformActor, raw: unknown): Promise<PlatformSettingsDto> {
  const data = parseInput(settingsUpdateSchema, raw);
  const row = await prisma.$transaction(async (tx) => {
    const saved = await tx.platformSetting.upsert({
      where: { id: SINGLETON_ID },
      update: { ...data, updatedByUserId: actor.id },
      create: { id: SINGLETON_ID, ...data, updatedByUserId: actor.id },
      select,
    });
    await recordAudit(tx, platformScope(actor), "PLATFORM_SETTINGS_UPDATED", "PlatformSetting", SINGLETON_ID, { fields: Object.keys(data) });
    return saved;
  });
  return toDto(row);
}

/** Internal read of maintenance state for the status service (no DTO). */
export async function getMaintenanceState(): Promise<{ maintenanceMode: boolean; maintenanceMessage: string | null }> {
  const row = await prisma.platformSetting.findUnique({ where: { id: SINGLETON_ID }, select: { maintenanceMode: true, maintenanceMessage: true } });
  return { maintenanceMode: row?.maintenanceMode ?? false, maintenanceMessage: row?.maintenanceMessage ?? null };
}
