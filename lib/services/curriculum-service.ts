import { setState } from "@/lib/data/store";
import type { CurriculumUnit, ProgressStatus } from "@/lib/types/academics";
import { generateId } from "@/lib/utils";

function mapUnit(units: CurriculumUnit[], unitId: string, fn: (u: CurriculumUnit) => CurriculumUnit): CurriculumUnit[] {
  return units.map((u) => (u.id === unitId ? fn(u) : u));
}

export function updateUnitStatus(unitId: string, status: ProgressStatus, completedPeriods?: number) {
  setState((db) => ({
    ...db,
    curriculumUnits: mapUnit(db.curriculumUnits, unitId, (u) => ({
      ...u,
      status,
      completedPeriods: completedPeriods ?? u.completedPeriods,
      actualCompletion: status === "completed" ? new Date().toISOString() : u.actualCompletion,
    })),
  }));
}

export function updateChapterStatus(unitId: string, chapterId: string, status: ProgressStatus) {
  setState((db) => ({
    ...db,
    curriculumUnits: mapUnit(db.curriculumUnits, unitId, (u) => ({
      ...u,
      chapters: u.chapters.map((c) =>
        c.id === chapterId ? { ...c, status, actualCompletion: status === "completed" ? new Date().toISOString() : c.actualCompletion } : c,
      ),
    })),
  }));
}

export function updateTopicStatus(unitId: string, chapterId: string, topicId: string, status: ProgressStatus) {
  setState((db) => ({
    ...db,
    curriculumUnits: mapUnit(db.curriculumUnits, unitId, (u) => ({
      ...u,
      chapters: u.chapters.map((c) => (c.id === chapterId ? { ...c, topics: c.topics.map((t) => (t.id === topicId ? { ...t, status } : t)) } : c)),
    })),
  }));
}

export function addUnit(unit: Omit<CurriculumUnit, "id" | "chapters" | "completedPeriods">) {
  const newUnit: CurriculumUnit = { ...unit, id: generateId("unit"), chapters: [], completedPeriods: 0 };
  setState((db) => ({ ...db, curriculumUnits: [...db.curriculumUnits, newUnit] }));
  return newUnit;
}
