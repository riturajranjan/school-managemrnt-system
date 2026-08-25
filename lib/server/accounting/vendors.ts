// Vendor master (Production Accounting checkpoint) — real, PostgreSQL-backed.
// No balance/payable field exists anywhere on this model: this checkpoint
// implements no accounts-payable ledger, so a "vendor balance" would be
// fabricated. There is no delete endpoint — INACTIVE (status) is the only
// removal path, so a vendor referenced by a historical PurchaseOrder can
// never be destructively removed.
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { ListMeta } from "@/lib/server/api/response";
import type { VendorDto } from "@/lib/api/contracts";
import { isBroadAccountingManager, resolveAccountingBranch } from "./access";

type VendorRow = {
  id: string; code: string; name: string; contactPerson: string | null; email: string | null; phone: string | null;
  address: string | null; taxId: string | null; notes: string | null; status: string; createdAt: Date; updatedAt: Date;
};

function toDto(v: VendorRow): VendorDto {
  return {
    id: v.id, code: v.code, name: v.name, contactPerson: v.contactPerson, email: v.email, phone: v.phone,
    address: v.address, taxId: v.taxId, notes: v.notes, status: v.status === "ACTIVE" ? "active" : "inactive",
    createdAt: v.createdAt.toISOString(), updatedAt: v.updatedAt.toISOString(),
  };
}

export const listVendorsSchema = z.object({
  status: z.enum(["active", "inactive"]).optional(),
  search: z.string().trim().max(200).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});

export async function listVendors(scope: OrgScope, raw: unknown): Promise<{ data: VendorDto[]; meta: ListMeta }> {
  const input = parseInput(listVendorsSchema, raw);
  const where: Prisma.VendorWhereInput = {
    schoolId: scope.schoolId,
    ...(input.status ? { status: input.status.toUpperCase() as never } : {}),
    ...(input.search ? { OR: [{ name: { contains: input.search, mode: "insensitive" } }, { code: { contains: input.search, mode: "insensitive" } }] } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.vendor.count({ where }),
    prisma.vendor.findMany({ where, orderBy: { name: "asc" }, skip: (input.page - 1) * input.pageSize, take: input.pageSize }),
  ]);
  return { data: rows.map(toDto), meta: { page: input.page, pageSize: input.pageSize, total, totalPages: Math.max(1, Math.ceil(total / input.pageSize)) } };
}

async function requireVendorInScope(scope: OrgScope, vendorId: string): Promise<VendorRow> {
  const row = await prisma.vendor.findFirst({ where: { id: vendorId, schoolId: scope.schoolId } });
  if (!row) throw new HttpError("VENDOR_NOT_FOUND", "Vendor not found");
  return row;
}

export async function getVendor(scope: OrgScope, vendorId: string): Promise<VendorDto> {
  return toDto(await requireVendorInScope(scope, vendorId));
}

export const createVendorSchema = z.object({
  code: z.string().trim().min(1).max(30),
  name: z.string().trim().min(1).max(160),
  contactPerson: z.string().trim().max(120).optional(),
  email: z.string().trim().email().max(160).optional(),
  phone: z.string().trim().max(30).optional(),
  address: z.string().trim().max(300).optional(),
  taxId: z.string().trim().max(60).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export async function createVendor(scope: OrgScope, raw: unknown): Promise<VendorDto> {
  if (!(await isBroadAccountingManager(scope))) throw new HttpError("FORBIDDEN", "You do not have permission to perform this action.");
  const input = parseInput(createVendorSchema, raw);
  const clash = await prisma.vendor.findFirst({ where: { schoolId: scope.schoolId, code: { equals: input.code, mode: "insensitive" } }, select: { id: true } });
  if (clash) throw new HttpError("VENDOR_CODE_EXISTS", "A vendor with this code already exists");
  const branchId = await resolveAccountingBranch(scope);
  try {
    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.vendor.create({
        data: {
          tenantId: scope.tenantId, schoolId: scope.schoolId, branchId, code: input.code, name: input.name,
          contactPerson: input.contactPerson, email: input.email, phone: input.phone, address: input.address,
          taxId: input.taxId, notes: input.notes,
        },
      });
      await recordAudit(tx, scope, "VENDOR_CREATED", "Vendor", row.id, { code: row.code, name: row.name });
      return row;
    });
    return toDto(created);
  } catch (err) {
    // schoolId+code is DB-unique — a concurrent double-submit past the
    // findFirst check above hits the constraint here, never creating a
    // duplicate vendor code.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") throw new HttpError("VENDOR_CODE_EXISTS", "A vendor with this code already exists");
    throw err;
  }
}

export const updateVendorSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  contactPerson: z.string().trim().max(120).nullable().optional(),
  email: z.string().trim().email().max(160).nullable().optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  address: z.string().trim().max(300).nullable().optional(),
  taxId: z.string().trim().max(60).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

export async function updateVendor(scope: OrgScope, vendorId: string, raw: unknown): Promise<VendorDto> {
  if (!(await isBroadAccountingManager(scope))) throw new HttpError("FORBIDDEN", "You do not have permission to perform this action.");
  await requireVendorInScope(scope, vendorId);
  const input = parseInput(updateVendorSchema, raw);
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.vendor.update({
      where: { id: vendorId },
      data: {
        name: input.name,
        contactPerson: input.contactPerson === undefined ? undefined : input.contactPerson,
        email: input.email === undefined ? undefined : input.email,
        phone: input.phone === undefined ? undefined : input.phone,
        address: input.address === undefined ? undefined : input.address,
        taxId: input.taxId === undefined ? undefined : input.taxId,
        notes: input.notes === undefined ? undefined : input.notes,
        status: input.status ? (input.status === "active" ? "ACTIVE" : "INACTIVE") : undefined,
      },
    });
    await recordAudit(tx, scope, input.status ? "VENDOR_STATUS_CHANGED" : "VENDOR_UPDATED", "Vendor", vendorId, input.status ? { status: input.status } : undefined);
    return row;
  });
  return toDto(updated);
}

/** Used by purchase-orders.ts to validate + snapshot an ACTIVE vendor at PO creation time. */
export async function requireActiveVendor(scope: OrgScope, vendorId: string): Promise<VendorRow> {
  const row = await requireVendorInScope(scope, vendorId);
  if (row.status !== "ACTIVE") throw new HttpError("VENDOR_NOT_ACTIVE", "Only an active vendor can be used on a purchase order");
  return row;
}
