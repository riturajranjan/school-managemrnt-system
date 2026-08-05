import { beforeEach, describe, expect, it } from "vitest";
import { resetDemoData, getSnapshot } from "@/lib/data/store";
import { applyColumnMapping, parseCsvText, validateMappedRows } from "./import-service";

const HEADER = "firstName,lastName,dob,gender,className,sectionName,guardianFirstName,guardianPhone,admissionNumber";
const mapping = {
  firstName: "firstName",
  lastName: "lastName",
  dob: "dob",
  gender: "gender",
  className: "className",
  sectionName: "sectionName",
  guardianFirstName: "guardianFirstName",
  guardianPhone: "guardianPhone",
  admissionNumber: "admissionNumber",
};

function rowsFromCsv(csv: string) {
  const parsed = parseCsvText(csv);
  return applyColumnMapping(parsed.rows, mapping);
}

describe("import validation", () => {
  beforeEach(() => resetDemoData());

  it("accepts a fully valid row", () => {
    const csv = `${HEADER}\nAarav,Sharma,2016-04-12,male,Class 5,A,Rohit,+91 98765 43210,IMP-0001`;
    const { valid, errors } = validateMappedRows(rowsFromCsv(csv));
    expect(errors).toHaveLength(0);
    expect(valid).toHaveLength(1);
  });

  it("flags rows missing a required field", () => {
    const csv = `${HEADER}\n,Sharma,2016-04-12,male,Class 5,A,Rohit,+91 98765 43210,IMP-0002`;
    const { valid, errors } = validateMappedRows(rowsFromCsv(csv));
    expect(valid).toHaveLength(0);
    expect(errors.some((e) => e.field === "firstName")).toBe(true);
  });

  it("flags an invalid date of birth", () => {
    const csv = `${HEADER}\nAarav,Sharma,not-a-date,male,Class 5,A,Rohit,+91 98765 43210,IMP-0003`;
    const { errors } = validateMappedRows(rowsFromCsv(csv));
    expect(errors.some((e) => e.field === "dob")).toBe(true);
  });

  it("flags an unknown class", () => {
    const csv = `${HEADER}\nAarav,Sharma,2016-04-12,male,Class 99,A,Rohit,+91 98765 43210,IMP-0004`;
    const { errors } = validateMappedRows(rowsFromCsv(csv));
    expect(errors.some((e) => e.field === "className")).toBe(true);
  });

  it("flags an unknown section for a valid class", () => {
    const csv = `${HEADER}\nAarav,Sharma,2016-04-12,male,Class 5,Z,Rohit,+91 98765 43210,IMP-0005`;
    const { errors } = validateMappedRows(rowsFromCsv(csv));
    expect(errors.some((e) => e.field === "sectionName")).toBe(true);
  });

  it("flags an admission number that already exists in the system", () => {
    const existing = getSnapshot().students[0].admissionNumber;
    const csv = `${HEADER}\nAarav,Sharma,2016-04-12,male,Class 5,A,Rohit,+91 98765 43210,${existing}`;
    const { errors } = validateMappedRows(rowsFromCsv(csv));
    expect(errors.some((e) => e.field === "admissionNumber")).toBe(true);
  });

  it("flags duplicate admission numbers within the same file", () => {
    const csv = `${HEADER}\nAarav,Sharma,2016-04-12,male,Class 5,A,Rohit,+91 98765 43210,IMP-DUP\nDiya,Verma,2016-05-01,female,Class 5,A,Rohit,+91 98765 43211,IMP-DUP`;
    const { errors } = validateMappedRows(rowsFromCsv(csv));
    expect(errors.filter((e) => e.field === "admissionNumber")).toHaveLength(1);
  });

  it("flags an invalid guardian phone number", () => {
    const csv = `${HEADER}\nAarav,Sharma,2016-04-12,male,Class 5,A,Rohit,abc,IMP-0006`;
    const { errors } = validateMappedRows(rowsFromCsv(csv));
    expect(errors.some((e) => e.field === "guardianPhone")).toBe(true);
  });

  it("does a partial import — valid rows succeed independently of invalid ones", () => {
    const csv = `${HEADER}\nAarav,Sharma,2016-04-12,male,Class 5,A,Rohit,+91 98765 43210,IMP-GOOD\n,Verma,2016-05-01,female,Class 5,A,Rohit,+91 98765 43211,IMP-BAD`;
    const { valid, errors } = validateMappedRows(rowsFromCsv(csv));
    expect(valid).toHaveLength(1);
    expect(errors.length).toBeGreaterThan(0);
  });
});
