// Custom-domain service (Super Admin Phase SA-4L).
//
// HONEST scope: this manages domain RECORDS and their lifecycle only. There is
// NO DNS lookup, NO SSL provisioning and NO external provider integration in
// this phase — a domain stays PENDING until a platform admin performs an
// explicit, clearly-labelled MANUAL verification. We never fake VERIFIED on a
// timer. The tenant is always derived from the target School (never client-sent).
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import type { OrgScope } from "@/lib/server/api/scope";
import type { SchoolDomainDto } from "@/lib/api/contracts";
import { resolveSchoolTarget } from "./school-target";

export type DomainActor = { id: string; name: string | null };

// A single DNS hostname: labels of a-z/0-9/hyphen, a real TLD, no protocol,
// path, port, spaces or uppercase. Callers pass a bare host (portal.school.com).
const HOSTNAME_RE = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

const TYPE_TO_DB = { subdomain: "SUBDOMAIN", custom: "CUSTOM" } as const;
const STATUS_TO_DB = { pending: "PENDING", verified: "VERIFIED", failed: "FAILED", disabled: "DISABLED" } as const;

function typeToUi(t: string): string {
  return t.toLowerCase();
}
function statusToUi(s: string): string {
  return s.toLowerCase();
}

type DomainRow = {
  id: string;
  hostname: string;
  type: string;
  status: string;
  isPrimary: boolean;
  verificationToken: string | null;
  verifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  school: { id: string; name: string; tenantId: string };
};

function toDto(d: DomainRow): SchoolDomainDto {
  return {
    id: d.id,
    hostname: d.hostname,
    type: typeToUi(d.type),
    status: statusToUi(d.status),
    isPrimary: d.isPrimary,
    verificationToken: d.verificationToken,
    verifiedAt: d.verifiedAt ? d.verifiedAt.toISOString() : null,
    school: { id: d.school.id, name: d.school.name },
    tenant: { id: d.school.tenantId },
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  };
}

const includeSchool = { school: { select: { id: true, name: true, tenantId: true } } } as const;

function auditScope(actor: DomainActor, tenantId: string, schoolId: string): OrgScope {
  return { tenantId, schoolId, branchId: null, academicSessionId: null, actor: { id: actor.id, name: actor.name } };
}

/** Normalise + validate a hostname, or throw VALIDATION_ERROR. */
function normalizeHostname(raw: string): string {
  const host = raw.trim().toLowerCase();
  if (/[/:\s]/.test(host) || host.includes("://")) {
    throw new HttpError("VALIDATION_ERROR", "Enter a bare hostname (no protocol, port or path)");
  }
  if (!HOSTNAME_RE.test(host)) throw new HttpError("VALIDATION_ERROR", "Invalid hostname");
  return host;
}

/** List domains — all, or filtered to one school. Newest first. */
export async function listDomains(schoolId?: string): Promise<SchoolDomainDto[]> {
  const rows = await prisma.schoolDomain.findMany({
    where: schoolId ? { schoolId } : undefined,
    include: includeSchool,
    orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
  });
  return rows.map(toDto);
}

/** Register a hostname for a school. First domain for a school becomes primary. */
export async function createDomain(args: {
  actor: DomainActor;
  schoolId: string;
  hostname: string;
  type?: "subdomain" | "custom";
}): Promise<SchoolDomainDto> {
  const { actor, schoolId } = args;
  const target = await resolveSchoolTarget(schoolId);
  const hostname = normalizeHostname(args.hostname);
  const type = TYPE_TO_DB[args.type ?? "custom"];

  const clash = await prisma.schoolDomain.findUnique({ where: { hostname }, select: { id: true } });
  if (clash) throw new HttpError("CONFLICT", "This hostname is already registered");

  const existingCount = await prisma.schoolDomain.count({ where: { schoolId } });

  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.schoolDomain.create({
      data: {
        tenantId: target.tenantId,
        schoolId,
        hostname,
        type,
        status: "PENDING",
        isPrimary: existingCount === 0,
        verificationToken: randomBytes(16).toString("hex"),
      },
      include: includeSchool,
    });
    await recordAudit(tx, auditScope(actor, target.tenantId, schoolId), "DOMAIN_ADDED", "SchoolDomain", row.id, { hostname, type });
    return row;
  });

  return toDto(created);
}

// Allowed manual status moves. VERIFIED is only ever reached by an explicit admin
// action here (never automatically). No DNS/SSL side effects.
const STATUS_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["VERIFIED", "FAILED", "DISABLED"],
  VERIFIED: ["DISABLED"],
  FAILED: ["PENDING", "DISABLED"],
  DISABLED: ["PENDING"],
};

/** Manually move a domain's lifecycle status (labelled MANUAL in the UI). */
export async function setDomainStatus(args: {
  actor: DomainActor;
  domainId: string;
  status: "pending" | "verified" | "failed" | "disabled";
}): Promise<SchoolDomainDto> {
  const { actor, domainId } = args;
  const next = STATUS_TO_DB[args.status];
  const existing = await prisma.schoolDomain.findUnique({ where: { id: domainId }, select: { id: true, status: true, schoolId: true, tenantId: true } });
  if (!existing) throw new HttpError("NOT_FOUND", "Domain not found");
  if (existing.status !== next && !STATUS_TRANSITIONS[existing.status]?.includes(next)) {
    throw new HttpError("INVALID_STATUS_TRANSITION", `Cannot move a ${existing.status} domain to ${next}`);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.schoolDomain.update({
      where: { id: domainId },
      data: { status: next, verifiedAt: next === "VERIFIED" ? new Date() : next === "PENDING" || next === "FAILED" ? null : undefined },
      include: includeSchool,
    });
    await recordAudit(tx, auditScope(actor, existing.tenantId, existing.schoolId), "DOMAIN_STATUS_CHANGED", "SchoolDomain", domainId, { from: existing.status, to: next });
    return row;
  });

  return toDto(updated);
}

/** Remove a domain record. */
export async function deleteDomain(args: { actor: DomainActor; domainId: string }): Promise<{ id: string }> {
  const { actor, domainId } = args;
  const existing = await prisma.schoolDomain.findUnique({ where: { id: domainId }, select: { id: true, hostname: true, schoolId: true, tenantId: true } });
  if (!existing) throw new HttpError("NOT_FOUND", "Domain not found");
  await prisma.$transaction(async (tx) => {
    await tx.schoolDomain.delete({ where: { id: domainId } });
    await recordAudit(tx, auditScope(actor, existing.tenantId, existing.schoolId), "DOMAIN_REMOVED", "SchoolDomain", domainId, { hostname: existing.hostname });
  });
  return { id: domainId };
}
