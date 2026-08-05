import type { FieldPath } from "react-hook-form";
import type { AdmissionFormValues } from "@/lib/schemas/admission-form";
import type { AdmissionStepKey } from "@/lib/schemas/admission-form";

// Field names react-hook-form's trigger() validates before allowing "Next" —
// kept separate from the zod schemas since guardiansStepSchema is a
// ZodEffects (refine-wrapped) and doesn't expose `.shape` for derivation.
export const stepFieldNames: Record<AdmissionStepKey, FieldPath<AdmissionFormValues>[]> = {
  student: ["firstName", "lastName", "dob", "gender", "nationality", "appliedClassId", "admissionType", "session"],
  guardians: ["guardians"],
  address: ["line1", "city", "state", "postalCode", "country"],
  previousSchool: [],
  academic: [],
  medical: ["medicalInfo.emergencyContact", "medicalInfo.emergencyPhone"],
  transport: [],
  hostel: [],
  documents: [],
  interview: [],
  fee: [],
  review: [],
};
