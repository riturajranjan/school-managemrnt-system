"use client";

import { useMemo } from "react";
import { useSisStore } from "./use-store";
import type { AdmissionApplication } from "@/lib/types/admissions";

export function useAdmissionApplications(): AdmissionApplication[] {
  const db = useSisStore();
  return db.applications;
}

export function useAdmissionApplication(id: string | undefined): AdmissionApplication | undefined {
  const db = useSisStore();
  return useMemo(() => db.applications.find((a) => a.id === id), [db.applications, id]);
}
