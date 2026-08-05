import type { ID } from "./common";

export const weekDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
export type WeekDay = (typeof weekDays)[number];

export type PeriodDefinition = {
  index: number;
  label: string;
  startTime: string;
  endTime: string;
  isBreak: boolean;
};

// Fixed 8-period school day with a short and lunch break — shared by every
// timetable so class/teacher/room grids all line up on the same columns.
export const periodDefinitions: PeriodDefinition[] = [
  { index: 1, label: "P1", startTime: "08:00", endTime: "08:45", isBreak: false },
  { index: 2, label: "P2", startTime: "08:45", endTime: "09:30", isBreak: false },
  { index: 3, label: "P3", startTime: "09:30", endTime: "10:15", isBreak: false },
  { index: 4, label: "Short break", startTime: "10:15", endTime: "10:30", isBreak: true },
  { index: 5, label: "P4", startTime: "10:30", endTime: "11:15", isBreak: false },
  { index: 6, label: "P5", startTime: "11:15", endTime: "12:00", isBreak: false },
  { index: 7, label: "Lunch", startTime: "12:00", endTime: "12:40", isBreak: true },
  { index: 8, label: "P6", startTime: "12:40", endTime: "13:25", isBreak: false },
  { index: 9, label: "P7", startTime: "13:25", endTime: "14:10", isBreak: false },
  { index: 10, label: "P8", startTime: "14:10", endTime: "14:55", isBreak: false },
];

export type TimetableSlot = {
  id: ID;
  day: WeekDay;
  periodIndex: number;
  subjectId?: ID;
  teacherId?: ID;
  roomId?: ID;
  locked: boolean;
  note?: string;
};

export type TimetableStatus = "draft" | "published";

export type Timetable = {
  id: ID;
  session: string;
  branchId: string;
  classId: ID;
  sectionId: ID;
  effectiveFrom: string;
  status: TimetableStatus;
  updatedAt: string;
  slots: TimetableSlot[];
};

export type TimetableConflictType =
  | "teacher-double-booking"
  | "room-double-booking"
  | "subject-period-limit"
  | "consecutive-period-limit";

export type TimetableConflict = {
  id: ID;
  type: TimetableConflictType;
  description: string;
  day: WeekDay;
  periodIndex: number;
  slotIds: ID[];
  severity: "error" | "warning";
};
