import { z } from "zod";

export const examDetailsSchema = z
  .object({
    name: z.string().trim().min(1, "Exam name is required"),
    code: z.string().trim().min(1, "Exam code is required").max(20),
    type: z.enum([
      "unit-test",
      "weekly-test",
      "monthly-test",
      "midterm",
      "half-yearly",
      "annual",
      "pre-board",
      "board",
      "practical",
      "oral",
      "assignment",
      "project",
      "internal-assessment",
      "custom",
    ]),
    term: z.string().trim().min(1, "Term is required"),
    description: z.string().trim().optional().or(z.literal("")),
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().min(1, "End date is required"),
    resultDate: z.string().optional().or(z.literal("")),
    scope: z.enum(["internal", "external"]),
    mode: z.enum(["online", "offline"]),
    notifyOnPublish: z.boolean(),
  })
  .refine((data) => data.endDate >= data.startDate, { message: "End date must be on or after the start date", path: ["endDate"] })
  .refine((data) => !data.resultDate || data.resultDate >= data.endDate, { message: "Result date should be on or after the exam end date", path: ["resultDate"] });

export type ExamDetailsFormValues = z.infer<typeof examDetailsSchema>;
