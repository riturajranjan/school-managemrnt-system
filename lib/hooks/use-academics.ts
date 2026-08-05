"use client";

import { useMemo } from "react";
import { useSisStore } from "./use-store";

export function useManagedClasses() {
  const db = useSisStore();
  return db.classes;
}

export function useManagedClass(classId: string | undefined) {
  const db = useSisStore();
  return useMemo(() => db.classes.find((c) => c.id === classId), [db.classes, classId]);
}

export function useTeachers() {
  const db = useSisStore();
  return db.teachers;
}

export function useTeacher(teacherId: string | undefined) {
  const db = useSisStore();
  return useMemo(() => db.teachers.find((t) => t.id === teacherId), [db.teachers, teacherId]);
}

export function useSubjects() {
  const db = useSisStore();
  return db.subjects;
}

export function useSubjectAssignments(sectionId?: string) {
  const db = useSisStore();
  return useMemo(() => (sectionId ? db.subjectAssignments.filter((a) => a.sectionId === sectionId) : db.subjectAssignments), [db.subjectAssignments, sectionId]);
}

export function useCurriculumUnits() {
  const db = useSisStore();
  return db.curriculumUnits;
}

export function useLessonPlans() {
  const db = useSisStore();
  return db.lessonPlans;
}

export function useHomeworkList() {
  const db = useSisStore();
  return db.homework;
}

export function useHomeworkSubmissions(homeworkId?: string) {
  const db = useSisStore();
  return useMemo(
    () => (homeworkId ? db.homeworkSubmissions.filter((s) => s.homeworkId === homeworkId) : db.homeworkSubmissions),
    [db.homeworkSubmissions, homeworkId],
  );
}

export function useAcademicEvents() {
  const db = useSisStore();
  return db.academicEvents;
}

export function useStudentSupportAlerts(studentId?: string) {
  const db = useSisStore();
  return useMemo(
    () => (studentId ? db.studentSupportAlerts.filter((a) => a.studentId === studentId) : db.studentSupportAlerts),
    [db.studentSupportAlerts, studentId],
  );
}
