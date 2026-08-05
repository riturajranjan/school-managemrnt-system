import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { addSection, archiveClass, assignClassTeacher, createClass, restoreClass, updateClass } from "./academics-service";

describe("createClass", () => {
  beforeEach(() => resetDemoData());

  it("adds a new class with no sections", () => {
    const created = createClass("Class 11", 14);
    const db = getSnapshot();
    const found = db.classes.find((c) => c.id === created.id);
    expect(found).toBeDefined();
    expect(found?.name).toBe("Class 11");
    expect(found?.sections).toHaveLength(0);
    expect(found?.status).toBe("active");
  });

  it("does not affect existing classes", () => {
    const before = getSnapshot().classes.length;
    createClass("Class 12", 15);
    expect(getSnapshot().classes.length).toBe(before + 1);
  });
});

describe("updateClass / archiveClass / restoreClass", () => {
  beforeEach(() => resetDemoData());

  it("updates a class name", () => {
    const target = getSnapshot().classes[0];
    updateClass(target.id, { name: "Renamed Class" });
    expect(getSnapshot().classes.find((c) => c.id === target.id)?.name).toBe("Renamed Class");
  });

  it("archives and restores a class", () => {
    const target = getSnapshot().classes[0];
    archiveClass(target.id);
    expect(getSnapshot().classes.find((c) => c.id === target.id)?.status).toBe("archived");
    restoreClass(target.id);
    expect(getSnapshot().classes.find((c) => c.id === target.id)?.status).toBe("active");
  });
});

describe("addSection", () => {
  beforeEach(() => resetDemoData());

  it("adds a section to the targeted class only", () => {
    const target = getSnapshot().classes[0];
    const otherBefore = getSnapshot().classes[1].sections.length;
    const section = addSection(target.id, "Z", 30);

    const db = getSnapshot();
    expect(db.classes.find((c) => c.id === target.id)?.sections.some((s) => s.id === section.id)).toBe(true);
    expect(db.classes[1].sections.length).toBe(otherBefore);
  });
});

describe("assignClassTeacher", () => {
  beforeEach(() => resetDemoData());

  it("sets the class teacher for exactly the targeted section", () => {
    const target = getSnapshot().classes[0];
    const section = target.sections[0];
    const teacher = getSnapshot().teachers[2];

    assignClassTeacher(target.id, section.id, teacher.id);

    const updatedSection = getSnapshot().classes.find((c) => c.id === target.id)?.sections.find((s) => s.id === section.id);
    expect(updatedSection?.classTeacherId).toBe(teacher.id);
  });
});
