// Platform status service (Super Admin Phase SA-4N).
//
// HONEST status: reports ONLY real, measurable internal signals — maintenance
// mode (from settings), live database reachability, and manually-recorded
// incidents. There is NO external uptime/telemetry monitoring, so no uptime
// percentage is fabricated; services we cannot measure are listed as
// unmonitored. Incidents are manual records with a simple lifecycle.
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { PlatformIncidentDto, PlatformStatusDto } from "@/lib/api/contracts";
import { getMaintenanceState } from "./settings-service";
import { platformScope, type PlatformActor } from "./platform-audit";

const SEVERITY = ["minor", "major", "critical"] as const;
const OPEN_STATUSES = ["INVESTIGATING", "IDENTIFIED", "MONITORING"] as const;

// Services with no real telemetry in this deployment — reported honestly rather
// than faked with green ticks / uptime numbers.
const UNMONITORED_SERVICES = ["Email/SMS delivery", "Payment gateway", "GPS tracking", "External storage", "CDN / edge"];

export const createIncidentSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional(),
  severity: z.enum(SEVERITY).optional(),
});
export const updateIncidentSchema = z.object({
  status: z.enum(["investigating", "identified", "monitoring", "resolved"]).optional(),
  severity: z.enum(SEVERITY).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
});

type IncidentRow = {
  id: string; title: string; description: string | null; severity: string; status: string;
  startedAt: Date; resolvedAt: Date | null; createdAt: Date; updatedAt: Date;
};

function incidentDto(i: IncidentRow): PlatformIncidentDto {
  return {
    id: i.id, title: i.title, description: i.description, severity: i.severity.toLowerCase(), status: i.status.toLowerCase(),
    startedAt: i.startedAt.toISOString(), resolvedAt: i.resolvedAt ? i.resolvedAt.toISOString() : null,
    createdAt: i.createdAt.toISOString(), updatedAt: i.updatedAt.toISOString(),
  };
}

async function databaseReachable(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

/** A truthful status snapshot: real signals only. */
export async function getStatus(): Promise<PlatformStatusDto> {
  const [maintenance, reachable, openIncidents] = await Promise.all([
    getMaintenanceState(),
    databaseReachable(),
    prisma.platformIncident.findMany({ where: { status: { in: [...OPEN_STATUSES] } }, orderBy: { startedAt: "desc" } }),
  ]);
  return {
    maintenanceMode: maintenance.maintenanceMode,
    maintenanceMessage: maintenance.maintenanceMessage,
    databaseReachable: reachable,
    openIncidentCount: openIncidents.length,
    activeIncidents: openIncidents.map(incidentDto),
    unmonitoredServices: UNMONITORED_SERVICES,
    checkedAt: new Date().toISOString(),
  };
}

export async function createIncident(actor: PlatformActor, raw: unknown): Promise<PlatformIncidentDto> {
  const input = parseInput(createIncidentSchema, raw);
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.platformIncident.create({
      data: { title: input.title, description: input.description ?? null, severity: (input.severity ?? "minor").toUpperCase() as never, status: "INVESTIGATING", createdByUserId: actor.id },
    });
    await recordAudit(tx, platformScope(actor), "PLATFORM_INCIDENT_CREATED", "PlatformIncident", row.id, { title: row.title });
    return row;
  });
  return incidentDto(created);
}

export async function updateIncident(actor: PlatformActor, id: string, raw: unknown): Promise<PlatformIncidentDto> {
  const input = parseInput(updateIncidentSchema, raw);
  const existing = await prisma.platformIncident.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new HttpError("NOT_FOUND", "Incident not found");
  const nextStatus = input.status ? (input.status.toUpperCase() as never) : undefined;
  const resolving = input.status === "resolved";
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.platformIncident.update({
      where: { id },
      data: {
        status: nextStatus,
        severity: input.severity ? (input.severity.toUpperCase() as never) : undefined,
        description: input.description === undefined ? undefined : input.description,
        resolvedAt: resolving ? new Date() : input.status ? null : undefined,
      },
    });
    await recordAudit(tx, platformScope(actor), resolving ? "PLATFORM_INCIDENT_RESOLVED" : "PLATFORM_INCIDENT_UPDATED", "PlatformIncident", id, { status: input.status });
    return row;
  });
  return incidentDto(updated);
}

export async function resolveIncident(actor: PlatformActor, id: string): Promise<PlatformIncidentDto> {
  return updateIncident(actor, id, { status: "resolved" });
}
