// School branding service (Super Admin Phase SA-4L).
//
// Branding is per-school platform configuration persisted in SchoolBranding
// (one row per school). Storage boundary: URL/metadata ONLY — no file uploads,
// no base64/client-storage persistence. Colors are validated #RRGGBB and URLs
// http(s) server-side (no CSS/script injection). The tenant is derived from the
// School. Unset fields read back as null (defaults), so the client preview is
// never the source of truth — persisted DB values are.
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { recordAudit } from "@/lib/server/api/audit";
import type { OrgScope } from "@/lib/server/api/scope";
import { parseInput } from "@/lib/server/validation";
import type { SchoolBrandingDto } from "@/lib/api/contracts";
import { resolveSchoolTarget } from "./school-target";

export type BrandingActor = { id: string; name: string | null };

const hexColor = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a #RRGGBB colour")
  .nullable();

const httpUrl = z
  .string()
  .trim()
  .max(2048)
  .url("Enter a valid URL")
  .refine((u) => /^https?:\/\//i.test(u), "URL must start with http(s)://")
  .nullable();

// PATCH accepts a partial: any provided key is set; `null` clears it; omitted
// keys are untouched.
export const brandingUpdateSchema = z
  .object({
    displayName: z.string().trim().max(120).nullable(),
    logoUrl: httpUrl,
    faviconUrl: httpUrl,
    primaryColor: hexColor,
    secondaryColor: hexColor,
    accentColor: hexColor,
    loginHeadline: z.string().trim().max(160).nullable(),
    loginSubheadline: z.string().trim().max(240).nullable(),
    footerText: z.string().trim().max(240).nullable(),
  })
  .partial();

type BrandingRow = {
  displayName: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  loginHeadline: string | null;
  loginSubheadline: string | null;
  footerText: string | null;
  updatedAt: Date;
};

function toDto(school: { id: string; name: string; tenantId: string }, row: BrandingRow | null): SchoolBrandingDto {
  return {
    school: { id: school.id, name: school.name },
    tenant: { id: school.tenantId },
    displayName: row?.displayName ?? null,
    logoUrl: row?.logoUrl ?? null,
    faviconUrl: row?.faviconUrl ?? null,
    primaryColor: row?.primaryColor ?? null,
    secondaryColor: row?.secondaryColor ?? null,
    accentColor: row?.accentColor ?? null,
    loginHeadline: row?.loginHeadline ?? null,
    loginSubheadline: row?.loginSubheadline ?? null,
    footerText: row?.footerText ?? null,
    updatedAt: row ? row.updatedAt.toISOString() : null,
  };
}

const selectBranding = {
  displayName: true, logoUrl: true, faviconUrl: true, primaryColor: true, secondaryColor: true,
  accentColor: true, loginHeadline: true, loginSubheadline: true, footerText: true, updatedAt: true,
} as const;

function auditScope(actor: BrandingActor, tenantId: string, schoolId: string): OrgScope {
  return { tenantId, schoolId, branchId: null, academicSessionId: null, actor: { id: actor.id, name: actor.name } };
}

/** Read a school's branding (all-null defaults when never configured). */
export async function getBranding(schoolId: string): Promise<SchoolBrandingDto> {
  const target = await resolveSchoolTarget(schoolId);
  const row = await prisma.schoolBranding.findUnique({ where: { schoolId }, select: selectBranding });
  return toDto({ id: target.schoolId, name: target.name, tenantId: target.tenantId }, row);
}

/** Create/update a school's branding (partial). Colors/URLs validated. */
export async function updateBranding(args: { actor: BrandingActor; schoolId: string; input: unknown }): Promise<SchoolBrandingDto> {
  const { actor, schoolId } = args;
  const data = parseInput(brandingUpdateSchema, args.input);
  const target = await resolveSchoolTarget(schoolId);

  const row = await prisma.$transaction(async (tx) => {
    const saved = await tx.schoolBranding.upsert({
      where: { schoolId },
      update: { ...data, updatedBy: actor.id },
      create: { schoolId, tenantId: target.tenantId, ...data, updatedBy: actor.id },
      select: selectBranding,
    });
    await recordAudit(tx, auditScope(actor, target.tenantId, schoolId), "BRANDING_UPDATED", "SchoolBranding", schoolId, { fields: Object.keys(data) });
    return saved;
  });

  return toDto({ id: target.schoolId, name: target.name, tenantId: target.tenantId }, row);
}
