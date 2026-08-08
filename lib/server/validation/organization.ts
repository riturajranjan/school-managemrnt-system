import { z } from "zod";

// ---------------------------------------------------------------------------
// Server input schemas for the tenancy foundation. These validate untrusted
// input at the service boundary — independent of any client-side form schema.
// Never trust client validation; every write re-validates here.
// ---------------------------------------------------------------------------

const code = z
  .string()
  .min(1)
  .max(40)
  .regex(/^[A-Za-z0-9][A-Za-z0-9-]*$/, "Code may contain letters, numbers and hyphens");

const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export const createSchoolInput = z.object({
  name: z.string().min(1).max(200),
  code,
  shortName: z.string().max(60).optional(),
  schoolType: z.string().max(60).optional(),
  board: z.string().max(60).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(30).optional(),
  website: z.string().url().optional(),
});
export type CreateSchoolInput = z.infer<typeof createSchoolInput>;

export const createBranchInput = z.object({
  name: z.string().min(1).max(200),
  code,
  email: z.string().email().optional(),
  phone: z.string().max(30).optional(),
  city: z.string().max(120).optional(),
  state: z.string().max(120).optional(),
  timezone: z.string().max(60).optional(),
});
export type CreateBranchInput = z.infer<typeof createBranchInput>;

export const createAcademicSessionInput = z
  .object({
    name: z.string().min(1).max(120),
    code,
    startDate: calendarDate,
    endDate: calendarDate,
  })
  .refine((v) => v.endDate > v.startDate, { message: "endDate must be after startDate", path: ["endDate"] });
export type CreateAcademicSessionInput = z.infer<typeof createAcademicSessionInput>;
