"use client";

import { useMemo } from "react";
import { useSisStore } from "./use-store";
import type { Student } from "@/lib/types/students";

export function useStudents(): Student[] {
  const db = useSisStore();
  return db.students;
}

export function useStudent(id: string | undefined): Student | undefined {
  const db = useSisStore();
  return useMemo(() => db.students.find((s) => s.id === id), [db.students, id]);
}

export function useStudentGuardians(studentId: string | undefined) {
  const db = useSisStore();
  return useMemo(() => {
    if (!studentId) return [];
    const links = db.studentGuardianLinks.filter((l) => l.studentId === studentId);
    return links
      .map((link) => {
        const guardian = db.guardians.find((g) => g.id === link.guardianId);
        if (!guardian) return null;
        return { ...guardian, link };
      })
      .filter((g): g is NonNullable<typeof g> => g !== null);
  }, [db.studentGuardianLinks, db.guardians, studentId]);
}
