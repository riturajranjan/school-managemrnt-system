// Platform announcements service (Super Admin Phase SA-4N).
//
// Lifecycle: DRAFT → PUBLISHED → ARCHIVED. Announcements are shown IN-APP only —
// there is NO email/SMS/push delivery, so no delivery status/metrics are stored
// or claimed. Audience is a real enum (all-platform-users / platform-admins /
// all-schools).
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { PlatformAnnouncementDto } from "@/lib/api/contracts";
import { platformScope, type PlatformActor } from "./platform-audit";

const AUDIENCE_TO_DB = { "all-platform-users": "ALL_PLATFORM_USERS", "platform-admins": "PLATFORM_ADMINS", "all-schools": "ALL_SCHOOLS" } as const;
const toUi = (s: string) => s.toLowerCase().replace(/_/g, "-");

export const createSchema = z.object({
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(4000),
  category: z.string().trim().max(60).optional(),
  audience: z.enum(["all-platform-users", "platform-admins", "all-schools"]).optional(),
});
export const updateSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  body: z.string().trim().min(1).max(4000).optional(),
  category: z.string().trim().max(60).nullable().optional(),
  audience: z.enum(["all-platform-users", "platform-admins", "all-schools"]).optional(),
});

type Row = {
  id: string; title: string; body: string; category: string | null; status: string; audience: string;
  startsAt: Date | null; endsAt: Date | null; publishedAt: Date | null; createdAt: Date; updatedAt: Date;
};

function toDto(a: Row): PlatformAnnouncementDto {
  return {
    id: a.id, title: a.title, body: a.body, category: a.category, status: a.status.toLowerCase(), audience: toUi(a.audience),
    startsAt: a.startsAt ? a.startsAt.toISOString() : null, endsAt: a.endsAt ? a.endsAt.toISOString() : null,
    publishedAt: a.publishedAt ? a.publishedAt.toISOString() : null, createdAt: a.createdAt.toISOString(), updatedAt: a.updatedAt.toISOString(),
  };
}

export async function listAnnouncements(status?: string): Promise<PlatformAnnouncementDto[]> {
  const where = status ? { status: status.toUpperCase() as never } : undefined;
  const rows = await prisma.platformAnnouncement.findMany({ where, orderBy: { createdAt: "desc" } });
  return rows.map(toDto);
}

export async function getAnnouncement(id: string): Promise<PlatformAnnouncementDto> {
  const a = await prisma.platformAnnouncement.findUnique({ where: { id } });
  if (!a) throw new HttpError("NOT_FOUND", "Announcement not found");
  return toDto(a);
}

export async function createAnnouncement(actor: PlatformActor, raw: unknown): Promise<PlatformAnnouncementDto> {
  const input = parseInput(createSchema, raw);
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.platformAnnouncement.create({
      data: { title: input.title, body: input.body, category: input.category ?? null, audience: AUDIENCE_TO_DB[input.audience ?? "all-schools"], status: "DRAFT", createdByUserId: actor.id },
    });
    await recordAudit(tx, platformScope(actor), "ANNOUNCEMENT_CREATED", "PlatformAnnouncement", row.id, { title: row.title });
    return row;
  });
  return toDto(created);
}

export async function updateAnnouncement(actor: PlatformActor, id: string, raw: unknown): Promise<PlatformAnnouncementDto> {
  const input = parseInput(updateSchema, raw);
  const existing = await prisma.platformAnnouncement.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new HttpError("NOT_FOUND", "Announcement not found");
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.platformAnnouncement.update({
      where: { id },
      data: {
        title: input.title, body: input.body,
        category: input.category === undefined ? undefined : input.category,
        audience: input.audience ? AUDIENCE_TO_DB[input.audience] : undefined,
      },
    });
    await recordAudit(tx, platformScope(actor), "ANNOUNCEMENT_UPDATED", "PlatformAnnouncement", id);
    return row;
  });
  return toDto(updated);
}

export async function publishAnnouncement(actor: PlatformActor, id: string): Promise<PlatformAnnouncementDto> {
  const existing = await prisma.platformAnnouncement.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!existing) throw new HttpError("NOT_FOUND", "Announcement not found");
  if (existing.status === "ARCHIVED") throw new HttpError("CONFLICT", "Cannot publish an archived announcement");
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.platformAnnouncement.update({ where: { id }, data: { status: "PUBLISHED", publishedAt: new Date() } });
    await recordAudit(tx, platformScope(actor), "ANNOUNCEMENT_PUBLISHED", "PlatformAnnouncement", id);
    return row;
  });
  return toDto(updated);
}

export async function archiveAnnouncement(actor: PlatformActor, id: string): Promise<PlatformAnnouncementDto> {
  const existing = await prisma.platformAnnouncement.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new HttpError("NOT_FOUND", "Announcement not found");
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.platformAnnouncement.update({ where: { id }, data: { status: "ARCHIVED" } });
    await recordAudit(tx, platformScope(actor), "ANNOUNCEMENT_ARCHIVED", "PlatformAnnouncement", id);
    return row;
  });
  return toDto(updated);
}
