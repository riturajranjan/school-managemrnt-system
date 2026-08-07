import type { Student } from "@/lib/types/students";
import type { Teacher } from "@/lib/types/academics";
import type {
  Author,
  Book,
  BookCategory,
  BookCopy,
  CopyCondition,
  DigitalResource,
  DigitalResourceType,
  Library,
  LibraryFine,
  LibraryLoan,
  LibraryMember,
  LibraryReservation,
  LibraryRule,
  Publisher,
  ResourceType,
  Shelf,
  ShelfLocation,
} from "@/lib/types/library";
import { moneyFromMajor, zeroMoney } from "@/lib/finance/money";
import { addDays } from "@/lib/selectors/library-loan-rules";
import { seededHelpers } from "./rng";

const helpers = seededHelpers(7082026);
export const BRANCH = "main";

// A fixed "today" the seed is anchored to (matches the rng helper's clock) so
// overdue/ready dates are deterministic across SSR + client render.
const TODAY = "2026-08-05";

// ---------------------------------------------------------------------------
// Libraries + location hierarchy
// ---------------------------------------------------------------------------

export const libraries: Library[] = [
  { id: "lib-main", name: "Central Library", code: "LIB-CEN", branch: BRANCH, location: "Block A · Ground Floor", isPrimary: true, openingHours: "08:00–17:00", createdAt: TODAY, updatedAt: TODAY },
  { id: "lib-junior", name: "Junior Wing Library", code: "LIB-JR", branch: BRANCH, location: "Block C · First Floor", isPrimary: false, openingHours: "08:30–15:30", createdAt: TODAY, updatedAt: TODAY },
];

export const shelfLocations: ShelfLocation[] = [
  { id: "loc-zone-a", libraryId: "lib-main", level: "zone", name: "Reading Zone A", code: "ZA", createdAt: TODAY },
  { id: "loc-floor-g", libraryId: "lib-main", parentId: "loc-zone-a", level: "floor", name: "Ground Floor", code: "G", createdAt: TODAY },
  { id: "loc-sec-fic", libraryId: "lib-main", parentId: "loc-floor-g", level: "section", name: "Fiction", code: "FIC", createdAt: TODAY },
  { id: "loc-sec-ref", libraryId: "lib-main", parentId: "loc-floor-g", level: "section", name: "Reference", code: "REF", createdAt: TODAY },
];

const shelfSeed = [
  { code: "A1", label: "Fiction A1", path: "Zone A › Ground › Fiction", capacity: 60 },
  { code: "A2", label: "Fiction A2", path: "Zone A › Ground › Fiction", capacity: 60 },
  { code: "B1", label: "Reference B1", path: "Zone A › Ground › Reference", capacity: 40 },
  { code: "B2", label: "Science B2", path: "Zone A › Ground › Science", capacity: 50 },
  { code: "C1", label: "Mathematics C1", path: "Zone A › Ground › Mathematics", capacity: 50 },
  { code: "C2", label: "Languages C2", path: "Zone A › Ground › Languages", capacity: 45 },
  { code: "D1", label: "Periodicals D1", path: "Zone A › Ground › Periodicals", capacity: 30 },
  { code: "JR1", label: "Junior Picture JR1", path: "Junior › First › Picture Books", capacity: 40 },
];

export const shelves: Shelf[] = shelfSeed.map((s, i) => ({
  id: `shelf-${i + 1}`,
  libraryId: s.code.startsWith("JR") ? "lib-junior" : "lib-main",
  locationId: s.label.includes("Reference") ? "loc-sec-ref" : "loc-sec-fic",
  code: s.code,
  label: s.label,
  path: s.path,
  capacity: s.capacity,
  lastStockCheck: helpers.bool(0.6) ? helpers.daysAgoIso(helpers.int(5, 90)) : undefined,
  stocktakeStatus: helpers.pick(["verified", "due", "overdue", "never"] as const),
  createdAt: TODAY,
  updatedAt: TODAY,
}));

// ---------------------------------------------------------------------------
// Authors, publishers, categories
// ---------------------------------------------------------------------------

const authorNames = ["R.K. Narayan", "Ruskin Bond", "Sudha Murty", "A.P.J. Abdul Kalam", "Roald Dahl", "J.K. Rowling", "Chetan Bhagat", "Jules Verne", "Rachel Carson", "Yuval Noah Harari", "NCERT Board", "Isaac Asimov"];
export const authors: Author[] = authorNames.map((name, i) => ({ id: `author-${i + 1}`, name, nationality: helpers.pick(["Indian", "British", "American"]), createdAt: TODAY }));

const publisherNames = ["Penguin India", "Rupa Publications", "Oxford University Press", "NCERT", "Scholastic", "S. Chand"];
export const publishers: Publisher[] = publisherNames.map((name, i) => ({ id: `publisher-${i + 1}`, name, city: helpers.pick(["New Delhi", "Chennai", "Mumbai"]), createdAt: TODAY }));

const categorySeed: { name: string; classification: string; tone: BookCategory["colorTone"] }[] = [
  { name: "Fiction", classification: "800", tone: "info" },
  { name: "Science", classification: "500", tone: "success" },
  { name: "Mathematics", classification: "510", tone: "warning" },
  { name: "History", classification: "900", tone: "neutral" },
  { name: "Biography", classification: "920", tone: "info" },
  { name: "Reference", classification: "030", tone: "neutral" },
  { name: "Languages", classification: "400", tone: "success" },
  { name: "Textbooks", classification: "370", tone: "warning" },
];
export const bookCategories: BookCategory[] = categorySeed.map((c, i) => ({ id: `bookcat-${i + 1}`, name: c.name, classification: c.classification, colorTone: c.tone, createdAt: TODAY }));

// ---------------------------------------------------------------------------
// Books + copies
// ---------------------------------------------------------------------------

const titleSeed = [
  "Malgudi Days", "Wings of Fire", "The Blue Umbrella", "How I Taught My Grandmother to Read", "Matilda", "The Alchemist",
  "A Brief History of Time", "Cosmos", "Sapiens", "The Story of My Experiments with Truth", "Physics Part I", "Mathematics for Class X",
  "Journey to the Center of the Earth", "Silent Spring", "The Foundation Trilogy", "Discovery of India", "English Grammar & Composition", "Panchatantra",
  "The Jungle Book", "Around the World in 80 Days", "Chemistry Part II", "Indian History Digest", "Great Scientists", "Environmental Studies",
];

const bookTypes: ResourceType[] = ["book", "textbook", "reference", "book", "book", "book", "reference", "book", "book", "book", "textbook", "textbook", "book", "reference", "book", "book", "textbook", "book", "book", "book", "textbook", "reference", "book", "textbook"];
const coverColors = ["#022c43", "#18b0c8", "#0f766e", "#7c3aed", "#b45309", "#be123c", "#1d4ed8", "#047857"];

export const books: Book[] = titleSeed.map((title, i) => {
  const type = bookTypes[i];
  const referenceOnly = type === "reference";
  const category = helpers.pick(bookCategories);
  const shelf = helpers.pick(shelves.filter((s) => s.libraryId === "lib-main"));
  return {
    id: `book-${i + 1}`,
    libraryId: "lib-main",
    title,
    subtitle: undefined,
    isbn: `978-${helpers.int(10, 99)}-${helpers.int(1000, 9999)}-${helpers.int(100, 999)}-${helpers.int(0, 9)}`,
    accessionNumber: `ACC-${String(i + 1).padStart(5, "0")}`,
    authorId: helpers.pick(authors).id,
    coAuthorIds: [],
    publisherId: helpers.pick(publishers).id,
    edition: helpers.pick(["1st", "2nd", "3rd", "Revised"]),
    publicationYear: helpers.int(2005, 2024),
    language: helpers.pick(["English", "Hindi", "English"]),
    categoryId: category.id,
    subject: category.name,
    classRange: helpers.pick(["I–V", "VI–VIII", "IX–X", "XI–XII", "All"]),
    description: `${title} — a well-loved title in the ${category.name.toLowerCase()} collection.`,
    coverColor: coverColors[i % coverColors.length],
    keywords: [category.name.toLowerCase(), type],
    classification: category.classification,
    shelfId: shelf.id,
    rack: `R${helpers.int(1, 6)}`,
    referenceOnly,
    replacementCost: moneyFromMajor(helpers.int(150, 900), "INR"),
    status: referenceOnly ? "reference-only" : "available",
    archived: false,
    createdAt: TODAY,
    updatedAt: TODAY,
  };
});

const conditions: CopyCondition[] = ["new", "good", "good", "fair", "worn"];

export const bookCopies: BookCopy[] = books.flatMap((book, bi) => {
  const count = book.referenceOnly ? helpers.int(1, 2) : helpers.int(2, 4);
  return Array.from({ length: count }, (_, ci) => {
    const seq = `${bi + 1}-${ci + 1}`;
    return {
      id: `copy-${seq}`,
      bookId: book.id,
      libraryId: book.libraryId,
      accessionNumber: `${book.accessionNumber}/${ci + 1}`,
      barcode: `LIBC${String(bi + 1).padStart(4, "0")}${String(ci + 1).padStart(2, "0")}`,
      qrToken: `qr_${helpers.int(100000, 999999)}${seq.replace("-", "")}`,
      acquisitionDate: helpers.daysAgoIso(helpers.int(60, 700)).slice(0, 10),
      purchasePrice: moneyFromMajor(helpers.int(120, 800), "INR"),
      vendorId: undefined,
      shelfId: book.shelfId,
      condition: helpers.pick(conditions),
      loanStatus: "on-shelf" as const,
      currentHolderId: undefined,
      lastStockCheck: helpers.bool(0.5) ? helpers.daysAgoIso(helpers.int(5, 120)).slice(0, 10) : undefined,
      replacementCost: book.replacementCost,
      notes: undefined,
      createdAt: TODAY,
      updatedAt: TODAY,
    } satisfies BookCopy;
  });
});

// ---------------------------------------------------------------------------
// Loan rules
// ---------------------------------------------------------------------------

export const libraryRules: LibraryRule[] = [
  { id: "rule-default", libraryId: "lib-main", name: "Default policy", maxBooks: 3, loanDurationDays: 14, renewalCount: 1, renewalDurationDays: 7, gracePeriodDays: 2, finePerDay: moneyFromMajor(2, "INR"), maxFine: moneyFromMajor(200, "INR"), reservationAllowance: 2, allowReferenceLoan: false, allowDigitalDownload: true, priority: 0, createdAt: TODAY, updatedAt: TODAY },
  { id: "rule-teacher", libraryId: "lib-main", name: "Teacher policy", memberType: "teacher", maxBooks: 6, loanDurationDays: 30, renewalCount: 2, renewalDurationDays: 14, gracePeriodDays: 5, finePerDay: moneyFromMajor(1, "INR"), maxFine: moneyFromMajor(150, "INR"), reservationAllowance: 4, allowReferenceLoan: true, allowDigitalDownload: true, priority: 5, createdAt: TODAY, updatedAt: TODAY },
  { id: "rule-textbook", libraryId: "lib-main", name: "Textbook policy", resourceType: "textbook", maxBooks: 2, loanDurationDays: 90, renewalCount: 1, renewalDurationDays: 30, gracePeriodDays: 7, finePerDay: moneyFromMajor(1, "INR"), maxFine: moneyFromMajor(100, "INR"), reservationAllowance: 1, allowReferenceLoan: false, allowDigitalDownload: false, priority: 3, createdAt: TODAY, updatedAt: TODAY },
];

// ---------------------------------------------------------------------------
// Members (from students + teachers)
// ---------------------------------------------------------------------------

export function buildLibraryData(students: Student[], teachers: Teacher[]) {
  // Work on a fresh clone so re-seeding (resetDemoData) never double-applies
  // loan-status mutations onto the shared module-level `bookCopies` const.
  const copies: BookCopy[] = structuredClone(bookCopies);

  const studentMembers: LibraryMember[] = students.slice(0, 80).map((s, i) => ({
    id: `member-s-${s.id}`,
    libraryId: "lib-main",
    membershipId: `LM-S-${String(i + 1).padStart(4, "0")}`,
    type: "student" as const,
    personId: s.id,
    name: `${s.profile.firstName} ${s.profile.lastName}`,
    classOrDept: s.classId,
    status: helpers.bool(0.94) ? ("active" as const) : ("suspended" as const),
    joinedAt: helpers.daysAgoIso(helpers.int(30, 400)),
    cardBarcode: `LIBM${String(i + 1).padStart(5, "0")}`,
    createdAt: TODAY,
    updatedAt: TODAY,
  }));

  const teacherMembers: LibraryMember[] = teachers.map((t, i) => ({
    id: `member-t-${t.id}`,
    libraryId: "lib-main",
    membershipId: `LM-T-${String(i + 1).padStart(4, "0")}`,
    type: "teacher" as const,
    personId: t.id,
    name: t.name,
    classOrDept: t.department,
    status: "active" as const,
    joinedAt: helpers.daysAgoIso(helpers.int(60, 500)),
    cardBarcode: `LIBM9${String(i + 1).padStart(4, "0")}`,
    createdAt: TODAY,
    updatedAt: TODAY,
  }));

  const members = [...studentMembers, ...teacherMembers];

  // Loans — issue a share of copies to members, some active, some overdue, some returned.
  const loans: LibraryLoan[] = [];
  const fines: LibraryFine[] = [];
  const issuableCopies = copies.filter((c) => {
    const book = books.find((b) => b.id === c.bookId);
    return book && !book.referenceOnly;
  });
  const loanCopies = helpers.pickMany(issuableCopies, Math.min(90, issuableCopies.length));

  loanCopies.forEach((copy, i) => {
    const member = helpers.pick(members.filter((m) => m.status === "active"));
    const roll = helpers.rand();
    const issuedDaysAgo = helpers.int(1, 40);
    const issuedAt = helpers.daysAgoIso(issuedDaysAgo);
    const dueDate = addDays(issuedAt, member.type === "teacher" ? 30 : 14);
    const loanId = `loan-${i + 1}`;

    if (roll < 0.5) {
      // Active
      copy.loanStatus = "issued";
      copy.currentHolderId = member.id;
      loans.push({ id: loanId, libraryId: "lib-main", copyId: copy.id, bookId: copy.bookId, memberId: member.id, issuedAt, dueDate, renewalCount: helpers.bool(0.2) ? 1 : 0, status: dueDate < TODAY ? "overdue" : "active", issuedBy: "Library Desk", createdAt: issuedAt, updatedAt: issuedAt });
      if (dueDate < TODAY) {
        const days = Math.max(1, Math.round((new Date(TODAY).getTime() - new Date(dueDate).getTime()) / 86_400_000) - 2);
        fines.push({ id: `fine-${loanId}`, libraryId: "lib-main", memberId: member.id, loanId, copyId: copy.id, type: "overdue", amount: moneyFromMajor(Math.min(days * 2, 200), "INR"), paidAmount: zeroMoney("INR"), waivedAmount: zeroMoney("INR"), status: "pending", idempotencyKey: `overdue:${loanId}:${days}`, createdAt: TODAY, updatedAt: TODAY });
      }
    } else if (roll < 0.85) {
      // Returned
      const returnedAt = helpers.daysAgoIso(Math.max(0, issuedDaysAgo - helpers.int(3, 12)));
      loans.push({ id: loanId, libraryId: "lib-main", copyId: copy.id, bookId: copy.bookId, memberId: member.id, issuedAt, dueDate, returnedAt, renewalCount: 0, status: "returned", issuedBy: "Library Desk", returnedBy: "Library Desk", returnCondition: "good", createdAt: issuedAt, updatedAt: returnedAt });
    } else {
      // Lost
      copy.loanStatus = "issued";
      copy.condition = "lost";
      copy.currentHolderId = member.id;
      loans.push({ id: loanId, libraryId: "lib-main", copyId: copy.id, bookId: copy.bookId, memberId: member.id, issuedAt, dueDate, renewalCount: 0, status: "lost", issuedBy: "Library Desk", createdAt: issuedAt, updatedAt: TODAY });
      fines.push({ id: `fine-${loanId}`, libraryId: "lib-main", memberId: member.id, loanId, copyId: copy.id, type: "lost", amount: copy.replacementCost, paidAmount: zeroMoney("INR"), waivedAmount: zeroMoney("INR"), status: "pending", reason: "Copy reported lost", idempotencyKey: `lost:${loanId}`, createdAt: TODAY, updatedAt: TODAY });
    }
  });

  // Reservations — a few popular titles with waiting queues.
  const reservations: LibraryReservation[] = [];
  const popularBooks = helpers.pickMany(books.filter((b) => !b.referenceOnly), 5);
  popularBooks.forEach((book, bi) => {
    const queueLength = helpers.int(1, 3);
    for (let q = 0; q < queueLength; q++) {
      const member = helpers.pick(members.filter((m) => m.status === "active"));
      reservations.push({
        id: `resv-${bi + 1}-${q + 1}`,
        libraryId: "lib-main",
        bookId: book.id,
        memberId: member.id,
        queuePosition: q + 1,
        priority: member.type === "teacher" ? 1 : 0,
        status: q === 0 && helpers.bool(0.4) ? "ready" : "waiting",
        pickupLibraryId: "lib-main",
        reservedAt: helpers.daysAgoIso(helpers.int(1, 10)),
        readyAt: q === 0 ? helpers.daysAgoIso(1) : undefined,
        expiresAt: q === 0 ? addDays(TODAY, 3) : undefined,
        notified: q === 0,
        createdAt: TODAY,
        updatedAt: TODAY,
      });
    }
  });

  return { libraries, members, loans, reservations, fines, copies };
}

// ---------------------------------------------------------------------------
// Digital resources
// ---------------------------------------------------------------------------

const digitalSeed: { title: string; type: DigitalResourceType }[] = [
  { title: "Class X Physics Revision Notes", type: "notes" },
  { title: "Board Exam 2025 Question Paper — Maths", type: "question-paper" },
  { title: "Introduction to Python (E-book)", type: "ebook" },
  { title: "Water Cycle Explained (Video)", type: "video" },
  { title: "School Annual Magazine 2025", type: "magazine" },
  { title: "History of Ancient India (PDF)", type: "pdf" },
  { title: "Spoken English Audio Lessons", type: "audio" },
  { title: "NCERT Science Reference Link", type: "link" },
  { title: "Research: Renewable Energy in Schools", type: "research-paper" },
  { title: "Junior Storytime Audio", type: "audio" },
  { title: "Board Exam 2025 Question Paper — Science", type: "question-paper" },
  { title: "Environmental Studies Journal Vol. 3", type: "journal" },
];

export const digitalResources: DigitalResource[] = digitalSeed.map((d, i) => ({
  id: `digital-${i + 1}`,
  libraryId: "lib-main",
  title: d.title,
  type: d.type,
  fileUrl: d.type === "link" ? undefined : `/library/files/${d.type}-${i + 1}`,
  externalUrl: d.type === "link" ? "https://ncert.nic.in" : undefined,
  authorId: helpers.pick(authors).id,
  subject: helpers.pick(["Science", "Mathematics", "History", "English", "General"]),
  classRange: helpers.pick(["VI–VIII", "IX–X", "XI–XII", "All"]),
  categoryId: helpers.pick(bookCategories).id,
  description: `${d.title} — available to eligible members in the digital library.`,
  thumbnailColor: coverColors[i % coverColors.length],
  accessLevel: helpers.pick(["public", "students", "teachers", "class"] as const),
  allowDownload: helpers.bool(0.6),
  license: helpers.pick(["School licence", "Open", "CC-BY"]),
  version: 1,
  language: helpers.pick(["English", "Hindi"]),
  viewCount: helpers.int(0, 240),
  brokenLinkReported: false,
  publishedAt: helpers.daysAgoIso(helpers.int(5, 200)),
  createdAt: TODAY,
  updatedAt: TODAY,
}));
