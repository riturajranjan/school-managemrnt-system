import { z } from "zod";

export const studentFormSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  dob: z.string().min(1, "Date of birth is required"),
  gender: z.enum(["male", "female", "other", "prefer-not-to-say"]),
  admissionNumber: z.string().trim().min(1, "Admission number is required"),
  rollNumber: z.string().optional().or(z.literal("")),
  classId: z.string().min(1, "Class is required"),
  sectionId: z.string().min(1, "Section is required"),
  admissionDate: z.string().min(1, "Admission date is required"),
  guardianFirstName: z.string().trim().min(1, "Guardian first name is required"),
  guardianLastName: z.string().trim().min(1, "Guardian last name is required"),
  guardianPhone: z
    .string()
    .trim()
    .min(8, "Enter a valid phone number")
    .regex(/^[+()\s\d-]+$/, "Enter a valid phone number"),
  guardianEmail: z.string().email("Enter a valid email").optional().or(z.literal("")),
});

export type StudentFormValues = z.infer<typeof studentFormSchema>;

export const enrollmentFormSchema = z.object({
  admissionNumber: z.string().trim().min(1, "Admission number is required"),
  classId: z.string().min(1, "Select a class"),
  sectionId: z.string().min(1, "Select a section"),
  rollNumber: z.string().trim().min(1, "Roll number is required"),
  joiningDate: z.string().min(1, "Joining date is required"),
  feeStructureId: z.string().min(1, "Select a fee structure"),
  transportRouteId: z.string().optional().or(z.literal("")),
  hostelBlockId: z.string().optional().or(z.literal("")),
  createParentPortal: z.boolean(),
});

export type EnrollmentFormValues = z.infer<typeof enrollmentFormSchema>;
