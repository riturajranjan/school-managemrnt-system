import { setState, type Db } from "@/lib/data/store";
import type { AcademicEvent, ManagedClass, ManagedSection } from "@/lib/types/academics";
import { bulkUpdateSection } from "./students-service";
import { generateId } from "@/lib/utils";

function mapClass(db: Db, classId: string, fn: (c: ManagedClass) => ManagedClass): Db {
  return { ...db, classes: db.classes.map((c) => (c.id === classId ? fn(c) : c)) };
}

export function createClass(name: string, order: number): ManagedClass {
  const classId = generateId("class");
  const newClass: ManagedClass = { id: classId, name, order, status: "active", sections: [] };
  setState((db) => ({ ...db, classes: [...db.classes, newClass] }));
  return newClass;
}

export function updateClass(classId: string, patch: Partial<Pick<ManagedClass, "name" | "order">>) {
  setState((db) => mapClass(db, classId, (c) => ({ ...c, ...patch })));
}

export function archiveClass(classId: string) {
  setState((db) => mapClass(db, classId, (c) => ({ ...c, status: "archived" })));
}

export function restoreClass(classId: string) {
  setState((db) => mapClass(db, classId, (c) => ({ ...c, status: "active" })));
}

export function addSection(classId: string, name: string, capacity: number): ManagedSection {
  const section: ManagedSection = { id: generateId("section"), classId, name, capacity, enrolledCount: 0, shift: "morning" };
  setState((db) => mapClass(db, classId, (c) => ({ ...c, sections: [...c.sections, section] })));
  return section;
}

export function updateSection(classId: string, sectionId: string, patch: Partial<ManagedSection>) {
  setState((db) => mapClass(db, classId, (c) => ({ ...c, sections: c.sections.map((s) => (s.id === sectionId ? { ...s, ...patch } : s)) })));
}

export function assignClassTeacher(classId: string, sectionId: string, teacherId: string) {
  updateSection(classId, sectionId, { classTeacherId: teacherId });
}

export function setSectionCapacity(classId: string, sectionId: string, capacity: number) {
  updateSection(classId, sectionId, { capacity });
}

/** Duplicates a class's section structure (names/capacities/shift) into a brand-new class — used to bootstrap a new grade quickly. */
export function duplicateClassStructure(sourceClassId: string, newName: string, newOrder: number): ManagedClass | undefined {
  let created: ManagedClass | undefined;
  setState((current) => {
    const source = current.classes.find((c) => c.id === sourceClassId);
    if (!source) return current;
    const classId = generateId("class");
    created = {
      id: classId,
      name: newName,
      order: newOrder,
      status: "active",
      sections: source.sections.map((s) => ({
        id: generateId("section"),
        classId,
        name: s.name,
        capacity: s.capacity,
        enrolledCount: 0,
        shift: s.shift,
        roomId: undefined,
        classTeacherId: undefined,
      })),
    };
    return { ...current, classes: [...current.classes, created!] };
  });
  return created;
}

/**
 * Promotes every active student currently in `fromSectionId` into `toSectionId`
 * (a real, working bulk section move — reuses the Phase 2 bulk-update path so
 * timeline entries land the same way a manual transfer would).
 */
export function promoteSection(fromSectionId: string, toClassId: string, toSectionId: string, studentIds: string[], actorName: string) {
  bulkUpdateSection(studentIds, toSectionId, toClassId, actorName);
}

export function createAcademicEvent(data: Omit<AcademicEvent, "id">): AcademicEvent {
  const event: AcademicEvent = { ...data, id: generateId("event") };
  setState((db) => ({ ...db, academicEvents: [...db.academicEvents, event] }));
  return event;
}

export function updateAcademicEvent(eventId: string, patch: Partial<AcademicEvent>) {
  setState((db) => ({ ...db, academicEvents: db.academicEvents.map((e) => (e.id === eventId ? { ...e, ...patch } : e)) }));
}

export function deleteAcademicEvent(eventId: string) {
  setState((db) => ({ ...db, academicEvents: db.academicEvents.filter((e) => e.id !== eventId) }));
}

export function duplicateAcademicEvent(eventId: string, newStartDate: string): AcademicEvent | undefined {
  let created: AcademicEvent | undefined;
  setState((db) => {
    const source = db.academicEvents.find((e) => e.id === eventId);
    if (!source) return db;
    created = { ...source, id: generateId("event"), startDate: newStartDate, endDate: undefined };
    return { ...db, academicEvents: [...db.academicEvents, created] };
  });
  return created;
}
