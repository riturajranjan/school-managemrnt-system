import { z } from "zod";

/** Zod schema backing the multi-step Add/Edit Employee form. Frontend
 * validation only — no persistence. */
export const employeeFormSchema = z.object({
  // Step 1 — personal
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  gender: z.enum(["male", "female", "other"]),
  dob: z.string().min(1, "Date of birth is required"),
  // Step 2 — contact
  email: z.string().email("Enter a valid email"),
  phone: z.string().min(6, "Enter a valid phone number"),
  address: z.string().min(1, "Address is required"),
  // Step 3/4 — employment + department/designation
  departmentId: z.string().min(1, "Select a department"),
  designationId: z.string().min(1, "Select a designation"),
  branch: z.string().min(1),
  employmentType: z.enum(["permanent", "fixed-term", "probation", "temporary", "part-time", "consultant", "visiting-faculty"]),
  status: z.enum(["active", "probation", "on-leave", "notice-period", "suspended", "inactive", "resigned", "retired"]),
  joiningDate: z.string().min(1, "Joining date is required"),
  isTeaching: z.boolean(),
  // Step 5 — reporting
  reportingManagerId: z.string().optional(),
  // Step 6/7 — salary + bank (display only)
  grossSalaryMajor: z.number({ message: "Enter a valid amount" }).min(0, "Salary cannot be negative"),
  bankName: z.string().optional(),
  bankAccountMasked: z.string().optional(),
  // Step 9 — emergency contact
  emergencyName: z.string().optional(),
  emergencyRelationship: z.string().optional(),
  emergencyPhone: z.string().optional(),
  // Step 10 — qualification
  qualificationDegree: z.string().optional(),
  qualificationInstitution: z.string().optional(),
  qualificationYear: z.string().optional(),
});

export type EmployeeFormValues = z.infer<typeof employeeFormSchema>;

export const employeeFormSteps = [
  { key: "personal", label: "Personal" },
  { key: "contact", label: "Contact" },
  { key: "employment", label: "Employment" },
  { key: "reporting", label: "Reporting & pay" },
  { key: "background", label: "Background" },
  { key: "review", label: "Review" },
] as const;
