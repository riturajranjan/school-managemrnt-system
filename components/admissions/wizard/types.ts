import type { AdmissionApplication } from "@/lib/types/admissions";

export type StepProps = {
  application: AdmissionApplication;
  goToStep: (index: number) => void;
};
