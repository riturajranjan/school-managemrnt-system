import { z } from "zod";

export const classFormSchema = z.object({
  name: z.string().trim().min(1, "Class name is required"),
  order: z.number().int().min(0).max(20),
});
export type ClassFormValues = z.infer<typeof classFormSchema>;

export const sectionFormSchema = z.object({
  name: z.string().trim().min(1, "Section name is required").max(2, "Use a short section label, e.g. A"),
  capacity: z.number().int().min(1, "Capacity must be at least 1").max(80),
  classTeacherId: z.string().optional().or(z.literal("")),
  roomId: z.string().optional().or(z.literal("")),
  shift: z.enum(["morning", "afternoon"]),
});
export type SectionFormValues = z.infer<typeof sectionFormSchema>;

export const subjectFormSchema = z.object({
  name: z.string().trim().min(1, "Subject name is required"),
  code: z.string().trim().min(1, "Subject code is required").max(10),
  shortName: z.string().trim().min(1, "Short name is required").max(6),
  department: z.string().trim().min(1, "Department is required"),
  type: z.enum(["core", "elective", "optional", "practical", "language", "co-curricular"]),
  gradeRangeStart: z.number().int().min(0).max(13),
  gradeRangeEnd: z.number().int().min(0).max(13),
  credit: z.number().int().min(1).max(10),
  passingMarks: z.number().int().min(0).max(100),
  maxMarks: z.number().int().min(1).max(200),
  theoryMarks: z.number().int().min(0).max(200),
  practicalMarks: z.number().int().min(0).max(200),
  color: z.string().min(1),
});
export type SubjectFormValues = z.infer<typeof subjectFormSchema>;

export const subjectAssignmentFormSchema = z.object({
  subjectId: z.string().min(1, "Select a subject"),
  sectionId: z.string().min(1, "Select a section"),
  primaryTeacherId: z.string().min(1, "Assign a teacher"),
  weeklyPeriods: z.number().int().min(1).max(10),
  roomId: z.string().optional().or(z.literal("")),
});
export type SubjectAssignmentFormValues = z.infer<typeof subjectAssignmentFormSchema>;

export const homeworkFormSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().trim().min(1, "Description is required"),
  classId: z.string().min(1, "Select a class"),
  sectionId: z.string().min(1, "Select a section"),
  subjectId: z.string().min(1, "Select a subject"),
  dueDate: z.string().min(1, "Due date is required"),
  maxMarks: z.number().int().min(0).max(200),
  instructions: z.string().trim().min(1, "Instructions are required"),
  submissionType: z.enum(["offline", "text", "file", "image", "link", "quiz", "mixed"]),
  allowLateSubmission: z.boolean(),
  requireParentAcknowledgement: z.boolean(),
});
export type HomeworkFormValues = z.infer<typeof homeworkFormSchema>;

// Phase 9E.2 — real leaveTypeId (a real LeaveType.id), not a fixed mock enum.
export const leaveFormSchema = z
  .object({
    leaveTypeId: z.string().min(1, "Select a leave type"),
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().min(1, "End date is required"),
    halfDay: z.boolean(),
    reason: z.string().trim().min(5, "Please provide a brief reason"),
  })
  .refine((data) => new Date(data.endDate) >= new Date(data.startDate), {
    message: "End date must be on or after the start date",
    path: ["endDate"],
  });
export type LeaveFormValues = z.infer<typeof leaveFormSchema>;
