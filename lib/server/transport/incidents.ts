// Transport Incidents — real, factual records. type/severity/status/
// parentNotified/authorityNotified are plain fields, not an insurance/police
// workflow engine. vehicle/route/trip are optional real FKs — never a
// free-text "which vehicle" string. Gated by the existing transport.view/
// transport.manage permissions (Transport's catalog already maps 1:1 to the
// intended manager tier — see access.ts).
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type {
  TransportIncidentDto,
  TransportIncidentSeverityDto,
  TransportIncidentStatusDto,
  TransportIncidentTypeDto,
} from "@/lib/api/contracts";
import { resolveTransportBranch } from "./access";

const TYPE_TO_DB: Record<TransportIncidentTypeDto, string> = {
  breakdown: "BREAKDOWN", accident: "ACCIDENT", delay: "DELAY", "safety-concern": "SAFETY_CONCERN", behaviour: "BEHAVIOUR", other: "OTHER",
};
const SEVERITY_TO_DB: Record<TransportIncidentSeverityDto, string> = { low: "LOW", medium: "MEDIUM", high: "HIGH", critical: "CRITICAL" };
const STATUS_TO_DB: Record<TransportIncidentStatusDto, string> = { open: "OPEN", investigating: "INVESTIGATING", resolved: "RESOLVED", closed: "CLOSED" };
const typeToUi = (t: string) => t.toLowerCase().replace(/_/g, "-") as TransportIncidentTypeDto;
const severityToUi = (s: string) => s.toLowerCase() as TransportIncidentSeverityDto;
const statusToUi = (s: string) => s.toLowerCase() as TransportIncidentStatusDto;

const select = {
  id: true, vehicleId: true, routeId: true, tripId: true, type: true, severity: true, status: true, occurredAt: true,
  location: true, description: true, immediateAction: true, resolution: true, parentNotified: true, authorityNotified: true,
  reportedByUserId: true, reportedByName: true, resolvedAt: true, createdAt: true,
  vehicle: { select: { registrationNumber: true } },
  route: { select: { name: true } },
} satisfies Prisma.TransportIncidentSelect;
type Row = Prisma.TransportIncidentGetPayload<{ select: typeof select }>;

function dto(r: Row): TransportIncidentDto {
  return {
    id: r.id, vehicleId: r.vehicleId, vehicleRegistration: r.vehicle?.registrationNumber ?? null,
    routeId: r.routeId, routeName: r.route?.name ?? null, tripId: r.tripId,
    type: typeToUi(r.type), severity: severityToUi(r.severity), status: statusToUi(r.status),
    occurredAt: r.occurredAt.toISOString(), location: r.location, description: r.description,
    immediateAction: r.immediateAction, resolution: r.resolution, parentNotified: r.parentNotified, authorityNotified: r.authorityNotified,
    reportedByName: r.reportedByName ?? "—", resolvedAt: r.resolvedAt?.toISOString() ?? null, createdAt: r.createdAt.toISOString(),
  };
}

export async function listIncidents(scope: OrgScope, params: { status?: string; vehicleId?: string } = {}): Promise<TransportIncidentDto[]> {
  const where: Prisma.TransportIncidentWhereInput = { schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) };
  if (params.status) where.status = params.status.toUpperCase() as never;
  if (params.vehicleId) where.vehicleId = params.vehicleId;
  const rows = await prisma.transportIncident.findMany({ where, orderBy: { occurredAt: "desc" }, select });
  return rows.map(dto);
}

async function requireIncidentInScope(scope: OrgScope, id: string): Promise<Row> {
  const row = await prisma.transportIncident.findFirst({ where: { id, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) }, select });
  if (!row) throw new HttpError("NOT_FOUND", "Incident not found");
  return row;
}

export const reportIncidentSchema = z.object({
  type: z.enum(["breakdown", "accident", "delay", "safety-concern", "behaviour", "other"]),
  severity: z.enum(["low", "medium", "high", "critical"]),
  occurredAt: z.string().datetime().optional(),
  vehicleId: z.string().min(1).optional(),
  routeId: z.string().min(1).optional(),
  tripId: z.string().min(1).optional(),
  location: z.string().trim().max(200).optional(),
  description: z.string().trim().min(1).max(2000),
  immediateAction: z.string().trim().max(2000).optional(),
  parentNotified: z.boolean().optional(),
  authorityNotified: z.boolean().optional(),
});

export async function reportIncident(scope: OrgScope, raw: unknown): Promise<TransportIncidentDto> {
  const input = parseInput(reportIncidentSchema, raw);
  if (input.vehicleId) {
    const v = await prisma.transportVehicle.findFirst({ where: { id: input.vehicleId, schoolId: scope.schoolId }, select: { id: true } });
    if (!v) throw new HttpError("VALIDATION_ERROR", "Vehicle must be real and in this school");
  }
  if (input.routeId) {
    const r = await prisma.transportRoute.findFirst({ where: { id: input.routeId, schoolId: scope.schoolId }, select: { id: true } });
    if (!r) throw new HttpError("VALIDATION_ERROR", "Route must be real and in this school");
  }
  const branchId = await resolveTransportBranch(scope);
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.transportIncident.create({
      data: {
        tenantId: scope.tenantId, schoolId: scope.schoolId, branchId,
        vehicleId: input.vehicleId ?? null, routeId: input.routeId ?? null, tripId: input.tripId ?? null,
        type: TYPE_TO_DB[input.type] as never, severity: SEVERITY_TO_DB[input.severity] as never,
        occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date(),
        location: input.location ?? null, description: input.description, immediateAction: input.immediateAction ?? null,
        parentNotified: input.parentNotified ?? false, authorityNotified: input.authorityNotified ?? false,
        reportedByUserId: scope.actor.id, reportedByName: scope.actor.name,
      },
      select: { id: true },
    });
    await recordAudit(tx, scope, "TRANSPORT_INCIDENT_REPORTED", "TransportIncident", row.id, { type: input.type, severity: input.severity });
    return row.id;
  });
  return dto(await requireIncidentInScope(scope, created));
}

export const updateIncidentStatusSchema = z.object({
  status: z.enum(["investigating", "resolved", "closed"]),
  resolution: z.string().trim().max(2000).optional(),
});

export async function updateIncidentStatus(scope: OrgScope, id: string, raw: unknown): Promise<TransportIncidentDto> {
  const input = parseInput(updateIncidentStatusSchema, raw);
  const existing = await requireIncidentInScope(scope, id);
  const resolvedNow = input.status === "resolved" || input.status === "closed";
  await prisma.$transaction(async (tx) => {
    await tx.transportIncident.update({
      where: { id },
      data: {
        status: STATUS_TO_DB[input.status] as never,
        resolution: input.resolution ?? existing.resolution,
        resolvedAt: resolvedNow ? (existing.resolvedAt ?? new Date()) : existing.resolvedAt,
      },
    });
    await recordAudit(tx, scope, "TRANSPORT_INCIDENT_STATUS_CHANGED", "TransportIncident", id, { status: input.status });
  });
  return dto(await requireIncidentInScope(scope, id));
}
