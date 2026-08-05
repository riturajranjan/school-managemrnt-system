import { z } from "zod";

export const studentDetailsSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(60),
  middleName: z.string().trim().max(60).optional().or(z.literal("")),
  lastName: z.string().trim().min(1, "Last name is required").max(60),
  preferredName: z.string().trim().max(60).optional().or(z.literal("")),
  dob: z.string().min(1, "Date of birth is required"),
  gender: z.enum(["male", "female", "other", "prefer-not-to-say"]),
  bloodGroup: z.string().optional().or(z.literal("")),
  nationality: z.string().trim().min(1, "Nationality is required"),
  religion: z.string().optional().or(z.literal("")),
  category: z.string().optional().or(z.literal("")),
  motherTongue: z.string().optional().or(z.literal("")),
  photoUrl: z.string().optional().or(z.literal("")),
  appliedClassId: z.string().min(1, "Applied class is required"),
  appliedSectionPreference: z.string().optional().or(z.literal("")),
  admissionType: z.enum(["new", "transfer", "sibling", "staff-ward", "management-quota"]),
  session: z.string().min(1, "Academic session is required"),
});
export type StudentDetailsValues = z.infer<typeof studentDetailsSchema>;

export const guardianSchema = z.object({
  id: z.string(),
  role: z.enum(["father", "mother", "guardian"]),
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  relationship: z.string().optional().or(z.literal("")),
  occupation: z.string().optional().or(z.literal("")),
  organization: z.string().optional().or(z.literal("")),
  email: z.string().email("Enter a valid email").optional().or(z.literal("")),
  phone: z
    .string()
    .trim()
    .min(8, "Enter a valid phone number")
    .regex(/^[+()\s\d-]+$/, "Enter a valid phone number"),
  alternatePhone: z.string().optional().or(z.literal("")),
  isPrimary: z.boolean(),
  isEmergencyContact: z.boolean(),
  authorizedPickup: z.boolean(),
  communicationPreference: z.enum(["sms", "email", "whatsapp", "call"]),
});
export type GuardianFormValues = z.infer<typeof guardianSchema>;

export const guardiansStepSchema = z
  .object({ guardians: z.array(guardianSchema).min(1, "Add at least one parent or guardian") })
  .refine((data) => data.guardians.some((g) => g.isPrimary), {
    message: "Mark one guardian as the primary contact",
    path: ["guardians"],
  });
export type GuardiansStepValues = z.infer<typeof guardiansStepSchema>;

export const addressStepSchema = z.object({
  line1: z.string().trim().min(1, "Address line 1 is required"),
  line2: z.string().optional().or(z.literal("")),
  city: z.string().trim().min(1, "City is required"),
  state: z.string().trim().min(1, "State is required"),
  postalCode: z
    .string()
    .trim()
    .min(4, "Enter a valid postal code")
    .regex(/^\d+$/, "Postal code must be numeric"),
  country: z.string().trim().min(1, "Country is required"),
});
export type AddressStepValues = z.infer<typeof addressStepSchema>;

export const previousSchoolSchema = z.object({
  schoolName: z.string().optional().or(z.literal("")),
  board: z.string().optional().or(z.literal("")),
  lastClassCompleted: z.string().optional().or(z.literal("")),
  yearOfLeaving: z.string().optional().or(z.literal("")),
  reasonForLeaving: z.string().optional().or(z.literal("")),
  tcNumber: z.string().optional().or(z.literal("")),
});
export type PreviousSchoolValues = z.infer<typeof previousSchoolSchema>;

export const academicDetailsSchema = z.object({
  preferredSecondLanguage: z.string().optional().or(z.literal("")),
  extracurricularInterests: z.string().optional().or(z.literal("")),
  specialNeeds: z.string().optional().or(z.literal("")),
  siblingStudentId: z.string().optional().or(z.literal("")),
});
export type AcademicDetailsValues = z.infer<typeof academicDetailsSchema>;

export const medicalInfoSchema = z.object({
  allergies: z.string().optional().or(z.literal("")),
  conditions: z.string().optional().or(z.literal("")),
  medications: z.string().optional().or(z.literal("")),
  emergencyContact: z.string().trim().min(1, "Emergency contact name is required"),
  emergencyPhone: z
    .string()
    .trim()
    .min(8, "Enter a valid phone number")
    .regex(/^[+()\s\d-]+$/, "Enter a valid phone number"),
  physicianName: z.string().optional().or(z.literal("")),
});
export type MedicalInfoValues = z.infer<typeof medicalInfoSchema>;

export const transportStepSchema = z.object({
  required: z.boolean(),
  routeId: z.string().optional().or(z.literal("")),
  pickupStop: z.string().optional().or(z.literal("")),
});
export type TransportStepValues = z.infer<typeof transportStepSchema>;

export const hostelStepSchema = z.object({
  required: z.boolean(),
  blockPreference: z.enum(["boys", "girls", "co-ed"]).optional(),
});
export type HostelStepValues = z.infer<typeof hostelStepSchema>;

export const interviewStepSchema = z.object({
  preferredSlot: z.string().optional().or(z.literal("")),
  preferredMode: z.enum(["in-person", "phone", "video"]).optional(),
});
export type InterviewStepValues = z.infer<typeof interviewStepSchema>;

export const feeStepSchema = z.object({
  applicationFeePaid: z.boolean(),
  applicationFeeReference: z.string().optional().or(z.literal("")),
});
export type FeeStepValues = z.infer<typeof feeStepSchema>;

export const admissionFormSchema = studentDetailsSchema
  .merge(addressStepSchema)
  .extend({
    guardians: guardiansStepSchema.shape.guardians,
    previousSchool: previousSchoolSchema.optional(),
    academicDetails: academicDetailsSchema.optional(),
    medicalInfo: medicalInfoSchema,
    transport: transportStepSchema,
    hostel: hostelStepSchema,
    interview: interviewStepSchema.optional(),
    feeDetails: feeStepSchema,
  });
export type AdmissionFormValues = z.infer<typeof admissionFormSchema>;

export const admissionSteps = [
  { key: "student", label: "Student details", schema: studentDetailsSchema },
  { key: "guardians", label: "Parent & guardian details", schema: guardiansStepSchema },
  { key: "address", label: "Address", schema: addressStepSchema },
  { key: "previousSchool", label: "Previous school", schema: previousSchoolSchema },
  { key: "academic", label: "Academic details", schema: academicDetailsSchema },
  { key: "medical", label: "Medical information", schema: medicalInfoSchema },
  { key: "transport", label: "Transport requirement", schema: transportStepSchema },
  { key: "hostel", label: "Hostel requirement", schema: hostelStepSchema },
  { key: "documents", label: "Documents", schema: z.object({}) },
  { key: "interview", label: "Interview", schema: interviewStepSchema },
  { key: "fee", label: "Fee details", schema: feeStepSchema },
  { key: "review", label: "Review & submit", schema: z.object({}) },
] as const;

export type AdmissionStepKey = (typeof admissionSteps)[number]["key"];
