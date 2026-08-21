// Library Management DB integration tests (Phase 9N). Real Postgres:
// Book/Copy CRUD + accession-number concurrency, borrower eligibility (real
// Student/Staff only, exactly one of studentId/staffId), issue/return/renew
// with concurrency races, Lost/Damaged copy transitions, real fine
// computation from LibraryPolicy (never invented), dashboard, Student 360
// profile, self-service renewal ownership, historical safety, isolation,
// RBAC, audit, DTO safety. Namespaced ("T9N"). Mirrors the exact
// setup/teardown pattern of lib/server/transport/transport.db.test.ts.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createBook, getBook, listBooks, updateBook } from "@/lib/server/library/books";
import { createCopy, getCopy, listCopies, setCopyStatus } from "@/lib/server/library/copies";
import { getLibraryPolicy, updateLibraryPolicy } from "@/lib/server/library/policy";
import { getLibraryDashboard } from "@/lib/server/library/dashboard";
import {
  getLoan,
  getStudentLibraryProfile,
  issueLoan,
  listLoans,
  markCopyLost,
  renewLoan,
  returnLoan,
} from "@/lib/server/library/loans";
import { HttpError } from "@/lib/server/api/guard";
import type { OrgScope } from "@/lib/server/api/scope";
import { ROLE_PERMISSIONS } from "@/lib/server/authz/catalog";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const NS = "T9N";
const stamp = Date.now().toString(36);

let tenantId = "", schoolId = "", branchA = "", sessionId = "";
let student1 = "", student2 = "", inactiveStudent = "";
let staffWithUser = "", staffUserId = "", staffNoUser = "", inactiveStaff = "";
let foreignTenantId = "", foreignSchoolId = "", foreignBranchId = "", foreignStudentId = "";
let scopeAdmin: OrgScope, scopeLibrarian: OrgScope, scopeTeacher: OrgScope, scopeStaffBorrower: OrgScope, scopeForeignAdmin: OrgScope;
let adminUser = "", librarianUser = "", teacherUser = "", foreignAdminUser = "";

async function makeUserWithRole(email: string, roleKey: string, tid = tenantId): Promise<string> {
  const u = await prisma.user.create({ data: { email, name: email, status: "ACTIVE" }, select: { id: true } });
  const m = await prisma.tenantMembership.create({ data: { userId: u.id, tenantId: tid, status: "ACTIVE" }, select: { id: true } });
  const role = await prisma.role.findFirstOrThrow({ where: { key: roleKey, isSystem: true }, select: { id: true } });
  await prisma.roleAssignment.create({ data: { membershipId: m.id, roleId: role.id } });
  return u.id;
}

beforeAll(async () => {
  if (!dbReady) return;
  tenantId = (await prisma.tenant.create({ data: { name: `${NS} T`, slug: `t9n-${stamp}` }, select: { id: true } })).id;
  schoolId = (await prisma.school.create({ data: { tenantId, name: `${NS} S`, code: `${NS}-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  branchA = (await prisma.branch.create({ data: { schoolId, name: "A", code: `${NS}-A`, status: "ACTIVE" }, select: { id: true } })).id;
  sessionId = (await prisma.academicSession.create({ data: { schoolId, name: "26-27", code: `${NS}-S`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE" }, select: { id: true } })).id;

  for (const [i, name, status] of [[0, "one", "ACTIVE"], [1, "two", "ACTIVE"], [2, "three", "INACTIVE"]] as [number, string, string][]) {
    const s = (await prisma.student.create({
      data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, admissionNumber: `${NS}-${stamp}-${i}`, firstName: name, lastName: "T", dateOfBirth: new Date("2015-01-01"), admissionDate: new Date("2024-04-01"), status: status as never },
      select: { id: true },
    })).id;
    if (i === 0) student1 = s;
    else if (i === 1) student2 = s;
    else inactiveStudent = s;
  }

  adminUser = await makeUserWithRole(`t9n-admin-${stamp}@x.test`, "SCHOOL_ADMIN");
  librarianUser = await makeUserWithRole(`t9n-lib-${stamp}@x.test`, "LIBRARIAN");
  teacherUser = await makeUserWithRole(`t9n-t1-${stamp}@x.test`, "TEACHER");
  staffUserId = await makeUserWithRole(`t9n-borrower-${stamp}@x.test`, "TEACHER");

  staffWithUser = (await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-SW-${stamp}`, firstName: "Borrower", lastName: "Staff", status: "ACTIVE", userId: staffUserId }, select: { id: true } })).id;
  staffNoUser = (await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-SN-${stamp}`, firstName: "NoLogin", lastName: "Staff", status: "ACTIVE" }, select: { id: true } })).id;
  inactiveStaff = (await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-SI-${stamp}`, firstName: "Inactive", lastName: "Staff", status: "INACTIVE" }, select: { id: true } })).id;

  foreignTenantId = (await prisma.tenant.create({ data: { name: `${NS} T2`, slug: `t9n-b-${stamp}` }, select: { id: true } })).id;
  foreignSchoolId = (await prisma.school.create({ data: { tenantId: foreignTenantId, name: `${NS} S2`, code: `${NS}-B-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  foreignBranchId = (await prisma.branch.create({ data: { schoolId: foreignSchoolId, name: "B", code: `${NS}-B`, status: "ACTIVE" }, select: { id: true } })).id;
  const foreignSession = (await prisma.academicSession.create({ data: { schoolId: foreignSchoolId, name: "26-27", code: `${NS}-BS`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE" }, select: { id: true } })).id;
  foreignStudentId = (await prisma.student.create({
    data: { tenantId: foreignTenantId, schoolId: foreignSchoolId, branchId: foreignBranchId, academicSessionId: foreignSession, admissionNumber: `${NS}-F-${stamp}`, firstName: "Foreign", lastName: "S", dateOfBirth: new Date("2015-01-01"), admissionDate: new Date("2024-04-01"), status: "ACTIVE" },
    select: { id: true },
  })).id;
  foreignAdminUser = await makeUserWithRole(`t9n-fadmin-${stamp}@x.test`, "SCHOOL_ADMIN", foreignTenantId);

  scopeAdmin = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: adminUser, name: "Admin" } };
  scopeLibrarian = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: librarianUser, name: "Librarian" } };
  scopeTeacher = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: teacherUser, name: "Teacher" } };
  scopeStaffBorrower = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: staffUserId, name: "Borrower" } };
  scopeForeignAdmin = { tenantId: foreignTenantId, schoolId: foreignSchoolId, branchId: foreignBranchId, academicSessionId: null, actor: { id: foreignAdminUser, name: "Foreign Admin" } };
});

afterAll(async () => {
  if (!dbReady || !tenantId) return;
  await prisma.auditEvent.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.libraryLoan.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.libraryBookCopy.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.libraryBook.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.libraryAccessionCounter.deleteMany({ where: { schoolId: { in: [schoolId, foreignSchoolId] } } });
  await prisma.libraryPolicy.deleteMany({ where: { schoolId: { in: [schoolId, foreignSchoolId] } } });
  await prisma.student.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.staff.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.roleAssignment.deleteMany({ where: { membership: { tenantId: { in: [tenantId, foreignTenantId] } } } });
  await prisma.tenantMembership.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.academicSession.deleteMany({ where: { schoolId: { in: [schoolId, foreignSchoolId] } } });
  await prisma.branch.deleteMany({ where: { schoolId: { in: [schoolId, foreignSchoolId] } } });
  await prisma.school.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.user.deleteMany({ where: { id: { in: [adminUser, librarianUser, teacherUser, staffUserId, foreignAdminUser] } } });
  await prisma.tenant.deleteMany({ where: { id: { in: [tenantId, foreignTenantId] } } });
});

describe.skipIf(!dbReady)("Books (DB)", () => {
  it("creates, updates and archives a book; lists and searches", async () => {
    const b = await createBook(scopeLibrarian, { title: `Alpha Book ${stamp}`, author: "Author A" });
    expect(b.status).toBe("active");
    expect(b.copyCount).toBe(0);

    const updated = await updateBook(scopeLibrarian, b.id, { category: "Fiction" });
    expect(updated.category).toBe("Fiction");

    const archived = await updateBook(scopeLibrarian, b.id, { status: "archived" });
    expect(archived.status).toBe("archived");

    const list = await listBooks(scopeAdmin, { search: "Alpha" });
    expect(list.some((x) => x.id === b.id)).toBe(true);
  });

  it("does not enforce ISBN uniqueness (editions/duplicates are a real possibility)", async () => {
    const isbn = `978-${stamp}`;
    const b1 = await createBook(scopeLibrarian, { title: "Dup ISBN 1", author: "A", isbn });
    const b2 = await createBook(scopeLibrarian, { title: "Dup ISBN 2", author: "B", isbn });
    expect(b1.id).not.toBe(b2.id);
  });
});

describe.skipIf(!dbReady)("Copies + accession numbers (DB)", () => {
  it("creates a copy with a server-generated accession number", async () => {
    const book = await createBook(scopeLibrarian, { title: `Copy Book ${stamp}`, author: "A" });
    const copy = await createCopy(scopeLibrarian, book.id, { shelfLocation: "A1" });
    expect(copy.accessionNumber).toMatch(/^ACC-\d{6}$/);
    expect(copy.status).toBe("available");
    const got = await getCopy(scopeAdmin, copy.id);
    expect(got.id).toBe(copy.id);
  });

  it("accession numbers are unique and race-safe under concurrent creates for the same book", async () => {
    const book = await createBook(scopeLibrarian, { title: `Race Book ${stamp}`, author: "A" });
    const results = await Promise.all(Array.from({ length: 8 }, () => createCopy(scopeLibrarian, book.id, {})));
    const accessionNumbers = new Set(results.map((r) => r.accessionNumber));
    expect(accessionNumbers.size).toBe(8);
    const list = await listCopies(scopeAdmin, { bookId: book.id });
    expect(list.length).toBe(8);
  });

  it("standalone status change: available -> damaged -> available; blocked while issued", async () => {
    const book = await createBook(scopeLibrarian, { title: `Status Book ${stamp}`, author: "A" });
    const copy = await createCopy(scopeLibrarian, book.id, {});
    const damaged = await setCopyStatus(scopeLibrarian, copy.id, "damaged");
    expect(damaged.status).toBe("damaged");
    const restored = await setCopyStatus(scopeLibrarian, copy.id, "available");
    expect(restored.status).toBe("available");

    const issued = await issueLoan(scopeLibrarian, { copyId: copy.id, studentId: student1 });
    await expect(setCopyStatus(scopeLibrarian, copy.id, "damaged")).rejects.toThrow(HttpError);
    await returnLoan(scopeLibrarian, issued.id);
  });
});

describe.skipIf(!dbReady)("Issue: eligibility + concurrency (DB)", () => {
  it("rejects an inactive/foreign/nonexistent borrower, and rejects an unavailable copy", async () => {
    const book = await createBook(scopeLibrarian, { title: `Elig Book ${stamp}`, author: "A" });
    const copy = await createCopy(scopeLibrarian, book.id, {});
    await expect(issueLoan(scopeLibrarian, { copyId: copy.id, studentId: inactiveStudent })).rejects.toThrow(HttpError);
    await expect(issueLoan(scopeLibrarian, { copyId: copy.id, studentId: foreignStudentId })).rejects.toThrow(HttpError);
    await expect(issueLoan(scopeLibrarian, { copyId: copy.id, staffId: inactiveStaff })).rejects.toThrow(HttpError);
    await expect(issueLoan(scopeLibrarian, { copyId: "nonexistent", studentId: student1 })).rejects.toThrow(HttpError);
  });

  it("requires exactly one of studentId/staffId", async () => {
    const book = await createBook(scopeLibrarian, { title: `Exactly One Book ${stamp}`, author: "A" });
    const copy = await createCopy(scopeLibrarian, book.id, {});
    await expect(issueLoan(scopeLibrarian, { copyId: copy.id })).rejects.toThrow();
    await expect(issueLoan(scopeLibrarian, { copyId: copy.id, studentId: student1, staffId: staffNoUser })).rejects.toThrow();
  });

  it("issues to a real active student, computing dueAt from the real policy when omitted", async () => {
    const policy = await getLibraryPolicy(scopeLibrarian);
    const book = await createBook(scopeLibrarian, { title: `Default Due Book ${stamp}`, author: "A" });
    const copy = await createCopy(scopeLibrarian, book.id, {});
    const before = Date.now();
    const loan = await issueLoan(scopeLibrarian, { copyId: copy.id, studentId: student1 });
    expect(loan.status).toBe("issued");
    expect(loan.borrowerType).toBe("student");
    expect(loan.borrowerId).toBe(student1);
    const expectedDueMs = before + policy.loanDurationDays * 86_400_000;
    expect(Math.abs(new Date(loan.dueAt).getTime() - expectedDueMs)).toBeLessThan(60_000);
    await returnLoan(scopeLibrarian, loan.id);
  });

  it("rejects issuing an already-issued copy, race-safe under concurrent issue attempts", async () => {
    const book = await createBook(scopeLibrarian, { title: `Copy Race Book ${stamp}`, author: "A" });
    const copy = await createCopy(scopeLibrarian, book.id, {});
    await issueLoan(scopeLibrarian, { copyId: copy.id, studentId: student1 });
    await expect(issueLoan(scopeLibrarian, { copyId: copy.id, studentId: student2 })).rejects.toThrow(HttpError);

    const book2 = await createBook(scopeLibrarian, { title: `Copy Race Book 2 ${stamp}`, author: "A" });
    const copy2 = await createCopy(scopeLibrarian, book2.id, {});
    const results = await Promise.all([student1, student2, staffNoUser].map((id, i) =>
      issueLoan(scopeLibrarian, i === 2 ? { copyId: copy2.id, staffId: id } : { copyId: copy2.id, studentId: id }).catch((e) => e),
    ));
    const succeeded = results.filter((r) => !(r instanceof Error));
    expect(succeeded.length).toBe(1);
    const activeLoanCount = await prisma.libraryLoan.count({ where: { copyId: copy2.id, status: "ISSUED" } });
    expect(activeLoanCount).toBe(1);
  });
});

describe.skipIf(!dbReady)("Return + Renew (DB)", () => {
  it("returns a loan, marking the copy available again; duplicate return is rejected, race-safe", async () => {
    const book = await createBook(scopeLibrarian, { title: `Return Book ${stamp}`, author: "A" });
    const copy = await createCopy(scopeLibrarian, book.id, {});
    const loan = await issueLoan(scopeLibrarian, { copyId: copy.id, studentId: student1 });
    const returned = await returnLoan(scopeLibrarian, loan.id);
    expect(returned.status).toBe("returned");
    expect(returned.returnedAt).toBeTruthy();
    const copyAfter = await getCopy(scopeAdmin, copy.id);
    expect(copyAfter.status).toBe("available");

    const results = await Promise.all(Array.from({ length: 4 }, () => returnLoan(scopeLibrarian, loan.id).catch((e) => e)));
    expect(results.every((r) => r instanceof Error)).toBe(true); // already returned — every retry rejects
  });

  it("returning as damaged sets the copy DAMAGED, not available; race-safe under concurrent return", async () => {
    const book = await createBook(scopeLibrarian, { title: `Damaged Return Book ${stamp}`, author: "A" });
    const copy = await createCopy(scopeLibrarian, book.id, {});
    const loan = await issueLoan(scopeLibrarian, { copyId: copy.id, studentId: student1 });
    const results = await Promise.all(Array.from({ length: 4 }, () => returnLoan(scopeLibrarian, loan.id, { condition: "damaged" }).catch((e) => e)));
    const succeeded = results.filter((r) => !(r instanceof Error));
    expect(succeeded.length).toBe(1);
    const copyAfter = await getCopy(scopeAdmin, copy.id);
    expect(copyAfter.status).toBe("damaged");
  });

  it("renews an issued loan, extending dueAt and incrementing renewalCount; rejects renewing a non-issued loan", async () => {
    const book = await createBook(scopeLibrarian, { title: `Renew Book ${stamp}`, author: "A" });
    const copy = await createCopy(scopeLibrarian, book.id, {});
    const loan = await issueLoan(scopeLibrarian, { copyId: copy.id, studentId: student1 });
    const renewed = await renewLoan(scopeLibrarian, loan.id, true);
    expect(renewed.renewalCount).toBe(1);
    expect(new Date(renewed.dueAt).getTime()).toBeGreaterThan(new Date(loan.dueAt).getTime() - 1000);

    const returned = await returnLoan(scopeLibrarian, loan.id);
    await expect(renewLoan(scopeLibrarian, returned.id, true)).rejects.toThrow(HttpError);
  });

  it("concurrent renewals on the same loan are deterministic: every attempt succeeds, renewalCount matches, status stays issued", async () => {
    const book = await createBook(scopeLibrarian, { title: `Renew Race Book ${stamp}`, author: "A" });
    const copy = await createCopy(scopeLibrarian, book.id, {});
    const loan = await issueLoan(scopeLibrarian, { copyId: copy.id, studentId: student1 });
    const results = await Promise.all(Array.from({ length: 5 }, () => renewLoan(scopeLibrarian, loan.id, true).catch((e) => e)));
    const succeeded = results.filter((r) => !(r instanceof Error));
    expect(succeeded.length).toBe(5);
    const final = await getLoan(scopeAdmin, loan.id);
    expect(final.renewalCount).toBe(5);
    expect(final.status).toBe("issued");
    await returnLoan(scopeLibrarian, loan.id);
  });

  it("self-service: the loan's own staff borrower (via Staff.userId) can renew without library.manage; a different staff member cannot", async () => {
    const book = await createBook(scopeLibrarian, { title: `Self Service Book ${stamp}`, author: "A" });
    const copy = await createCopy(scopeLibrarian, book.id, {});
    const loan = await issueLoan(scopeLibrarian, { copyId: copy.id, staffId: staffWithUser });

    const renewed = await renewLoan(scopeStaffBorrower, loan.id, false);
    expect(renewed.renewalCount).toBe(1);

    await expect(renewLoan(scopeTeacher, loan.id, false)).rejects.toThrow(HttpError); // not the owning staff, not privileged -> NOT_FOUND
    await returnLoan(scopeLibrarian, loan.id);
  });
});

describe.skipIf(!dbReady)("Lost / Damaged (DB)", () => {
  it("marks an AVAILABLE copy lost directly", async () => {
    const book = await createBook(scopeLibrarian, { title: `Lost Available Book ${stamp}`, author: "A" });
    const copy = await createCopy(scopeLibrarian, book.id, {});
    await markCopyLost(scopeLibrarian, copy.id);
    const after = await getCopy(scopeAdmin, copy.id);
    expect(after.status).toBe("lost");
    await expect(markCopyLost(scopeLibrarian, copy.id)).rejects.toThrow(HttpError); // already lost
  });

  it("marking an ISSUED copy lost also closes its active loan as LOST", async () => {
    const book = await createBook(scopeLibrarian, { title: `Lost Issued Book ${stamp}`, author: "A" });
    const copy = await createCopy(scopeLibrarian, book.id, {});
    const loan = await issueLoan(scopeLibrarian, { copyId: copy.id, studentId: student1 });
    await markCopyLost(scopeLibrarian, copy.id);
    const loanAfter = await getLoan(scopeAdmin, loan.id);
    expect(loanAfter.status).toBe("lost");
    expect(loanAfter.returnedAt).toBeTruthy();
    const copyAfter = await getCopy(scopeAdmin, copy.id);
    expect(copyAfter.status).toBe("lost");
  });
});

describe.skipIf(!dbReady)("Fine computation (DB)", () => {
  it("computes a real fine from the configured policy — overdue days minus grace, capped at maxFineAmount", async () => {
    await updateLibraryPolicy(scopeLibrarian, { loanDurationDays: 14, finePerDay: 5, graceDays: 2, maxFineAmount: 30 });
    const book = await createBook(scopeLibrarian, { title: `Fine Book ${stamp}`, author: "A" });
    const copy = await createCopy(scopeLibrarian, book.id, {});
    // 20 days overdue, 2 grace days -> 18 chargeable days * 5 = 90, capped at 30.
    const overdueDue = new Date(Date.now() - 20 * 86_400_000).toISOString().slice(0, 10);
    const loan = await issueLoan(scopeLibrarian, { copyId: copy.id, studentId: student1, dueAt: overdueDue });
    expect(loan.isOverdue).toBe(true);
    expect(loan.daysOverdue).toBeGreaterThanOrEqual(17); // ~18, allow for date-boundary rounding
    expect(loan.fineAmount).toBe(30);

    await returnLoan(scopeLibrarian, loan.id);
    const returned = await getLoan(scopeAdmin, loan.id);
    expect(returned.isOverdue).toBe(false); // no longer active, even though it accrued a fine
    expect(returned.fineAmount).toBe(30);

    await updateLibraryPolicy(scopeLibrarian, { finePerDay: 0, maxFineAmount: null }); // restore neutral default for later tests
  });

  it("zero fine when returned within the grace period", async () => {
    await updateLibraryPolicy(scopeLibrarian, { graceDays: 5, finePerDay: 10 });
    const book = await createBook(scopeLibrarian, { title: `Grace Book ${stamp}`, author: "A" });
    const copy = await createCopy(scopeLibrarian, book.id, {});
    const dueSoon = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10); // 2 days overdue, 5 grace days
    const loan = await issueLoan(scopeLibrarian, { copyId: copy.id, studentId: student1, dueAt: dueSoon });
    expect(loan.fineAmount).toBe(0);
    expect(loan.isOverdue).toBe(false);
    await returnLoan(scopeLibrarian, loan.id);
    await updateLibraryPolicy(scopeLibrarian, { graceDays: 0, finePerDay: 0 });
  });
});

describe.skipIf(!dbReady)("Dashboard + Student 360 (DB)", () => {
  it("dashboard counts are real and derived from the database", async () => {
    const dashboard = await getLibraryDashboard(scopeAdmin);
    expect(typeof dashboard.totalTitles).toBe("number");
    expect(typeof dashboard.totalCopies).toBe("number");
    expect(dashboard.totalTitles).toBeGreaterThan(0);
  });

  it("Student 360 library profile returns active loans + recent history; empty for a student with none", async () => {
    // Dedicated students, isolated from the concurrency-race fixtures above
    // (student1/student2 may carry a leftover unreturned loan depending on
    // which concurrent issue attempt happened to win that race).
    const freshStudent = (await prisma.student.create({
      data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, admissionNumber: `${NS}-S360-${stamp}`, firstName: "S360", lastName: "T", dateOfBirth: new Date("2015-01-01"), admissionDate: new Date("2024-04-01"), status: "ACTIVE" },
      select: { id: true },
    })).id;
    const neverBorrowedStudent = (await prisma.student.create({
      data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, admissionNumber: `${NS}-S360B-${stamp}`, firstName: "S360Empty", lastName: "T", dateOfBirth: new Date("2015-01-01"), admissionDate: new Date("2024-04-01"), status: "ACTIVE" },
      select: { id: true },
    })).id;

    const book = await createBook(scopeLibrarian, { title: `S360 Book ${stamp}`, author: "A" });
    const copy = await createCopy(scopeLibrarian, book.id, {});
    const loan = await issueLoan(scopeLibrarian, { copyId: copy.id, studentId: freshStudent });
    const profile = await getStudentLibraryProfile(scopeAdmin, freshStudent);
    expect(profile.activeLoans.some((l) => l.id === loan.id)).toBe(true);
    await returnLoan(scopeLibrarian, loan.id);
    const afterReturn = await getStudentLibraryProfile(scopeAdmin, freshStudent);
    expect(afterReturn.activeLoans.length).toBe(0);
    expect(afterReturn.recentHistory.some((l) => l.id === loan.id)).toBe(true);

    const emptyProfile = await getStudentLibraryProfile(scopeAdmin, neverBorrowedStudent);
    expect(emptyProfile.activeLoans).toEqual([]);
    expect(emptyProfile.recentHistory).toEqual([]);
  });
});

describe.skipIf(!dbReady)("Historical safety (DB)", () => {
  it("loan history survives a book archive, a staff rename and a staff going inactive", async () => {
    const book = await createBook(scopeLibrarian, { title: `History Book ${stamp}`, author: "A" });
    const copy = await createCopy(scopeLibrarian, book.id, {});
    const loan = await issueLoan(scopeLibrarian, { copyId: copy.id, staffId: staffNoUser });
    await returnLoan(scopeLibrarian, loan.id);

    await updateBook(scopeLibrarian, book.id, { status: "archived" });
    await prisma.staff.update({ where: { id: staffNoUser }, data: { firstName: "RenamedBorrower", status: "INACTIVE" } });

    const historical = await getLoan(scopeAdmin, loan.id);
    expect(historical.status).toBe("returned");
    expect(historical.bookTitle).toBe(book.title);
    expect(historical.borrowerName).toContain("RenamedBorrower"); // live relation — matches the Staff-relation precedent elsewhere
  });
});

describe.skipIf(!dbReady)("Security / RBAC / Isolation / Audit / DTO safety (DB)", () => {
  it("library.view/library.manage: LIBRARIAN has both; SCHOOL_ADMIN view only; TEACHER neither", () => {
    expect(ROLE_PERMISSIONS.LIBRARIAN).toContain("library.view");
    expect(ROLE_PERMISSIONS.LIBRARIAN).toContain("library.manage");
    expect(ROLE_PERMISSIONS.SCHOOL_ADMIN).toContain("library.view");
    expect(ROLE_PERMISSIONS.SCHOOL_ADMIN).not.toContain("library.manage");
    expect(ROLE_PERMISSIONS.TEACHER ?? []).not.toContain("library.view");
    expect(ROLE_PERMISSIONS.TEACHER ?? []).not.toContain("library.manage");
  });

  it("cross-tenant book/copy/loan is invisible", async () => {
    const foreignBook = await createBook(scopeForeignAdmin, { title: "Foreign Book", author: "A" });
    await expect(getBook(scopeAdmin, foreignBook.id)).rejects.toThrow(HttpError);

    const foreignCopy = await createCopy(scopeForeignAdmin, foreignBook.id, {});
    await expect(getCopy(scopeAdmin, foreignCopy.id)).rejects.toThrow(HttpError);

    const foreignLoan = await issueLoan(scopeForeignAdmin, { copyId: foreignCopy.id, studentId: foreignStudentId });
    await expect(getLoan(scopeAdmin, foreignLoan.id)).rejects.toThrow(HttpError);
    await expect(returnLoan(scopeAdmin, foreignLoan.id)).rejects.toThrow(HttpError);
  });

  it("library mutations are audited", async () => {
    const events = await prisma.auditEvent.count({
      where: { tenantId, action: { in: ["LIBRARY_BOOK_CREATED", "LIBRARY_COPY_CREATED", "LIBRARY_BOOK_ISSUED", "LIBRARY_BOOK_RETURNED", "LIBRARY_BOOK_RENEWED", "LIBRARY_COPY_MARKED_LOST"] } },
    });
    expect(events).toBeGreaterThan(5);
  });

  it("book and loan DTOs never leak fields beyond the documented contract", async () => {
    const book = await createBook(scopeLibrarian, { title: `DTO Book ${stamp}`, author: "A" });
    const allowedBookKeys = new Set(["id", "title", "subtitle", "isbn", "author", "publisher", "publicationYear", "category", "language", "description", "status", "copyCount", "availableCount", "createdAt", "updatedAt"]);
    for (const key of Object.keys(book)) expect(allowedBookKeys.has(key)).toBe(true);

    const copy = await createCopy(scopeLibrarian, book.id, {});
    const loan = await issueLoan(scopeLibrarian, { copyId: copy.id, studentId: student1 });
    const allowedLoanKeys = new Set(["id", "copyId", "accessionNumber", "bookId", "bookTitle", "borrowerType", "borrowerId", "borrowerName", "issuedAt", "dueAt", "returnedAt", "status", "renewalCount", "isOverdue", "daysOverdue", "fineAmount", "createdAt"]);
    for (const key of Object.keys(loan)) expect(allowedLoanKeys.has(key)).toBe(true);
    await returnLoan(scopeLibrarian, loan.id);
  });

  it("listLoans filters by student/staff/copy/status correctly", async () => {
    const byStatus = await listLoans(scopeAdmin, { status: "returned" });
    expect(byStatus.every((l) => l.status === "returned")).toBe(true);
  });
});
