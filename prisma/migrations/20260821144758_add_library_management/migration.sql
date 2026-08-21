-- CreateEnum
CREATE TYPE "LibraryBookStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "LibraryCopyStatus" AS ENUM ('AVAILABLE', 'ISSUED', 'LOST', 'DAMAGED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "LibraryLoanStatus" AS ENUM ('ISSUED', 'RETURNED', 'LOST', 'CANCELLED');

-- CreateTable
CREATE TABLE "library_books" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "isbn" TEXT,
    "author" TEXT NOT NULL,
    "publisher" TEXT,
    "publicationYear" INTEGER,
    "category" TEXT,
    "language" TEXT,
    "description" TEXT,
    "status" "LibraryBookStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "library_books_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "library_book_copies" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "accessionNumber" TEXT NOT NULL,
    "barcode" TEXT,
    "status" "LibraryCopyStatus" NOT NULL DEFAULT 'AVAILABLE',
    "acquiredAt" TIMESTAMPTZ(6),
    "shelfLocation" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "library_book_copies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "library_accession_counters" (
    "schoolId" TEXT NOT NULL,
    "counter" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "library_accession_counters_pkey" PRIMARY KEY ("schoolId")
);

-- CreateTable
CREATE TABLE "library_policies" (
    "schoolId" TEXT NOT NULL,
    "loanDurationDays" INTEGER NOT NULL DEFAULT 14,
    "finePerDay" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "graceDays" INTEGER NOT NULL DEFAULT 0,
    "maxFineAmount" DECIMAL(10,2),
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedByUserId" TEXT,

    CONSTRAINT "library_policies_pkey" PRIMARY KEY ("schoolId")
);

-- CreateTable
CREATE TABLE "library_loans" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "copyId" TEXT NOT NULL,
    "studentId" TEXT,
    "staffId" TEXT,
    "issuedAt" TIMESTAMPTZ(6) NOT NULL,
    "dueAt" TIMESTAMPTZ(6) NOT NULL,
    "returnedAt" TIMESTAMPTZ(6),
    "status" "LibraryLoanStatus" NOT NULL DEFAULT 'ISSUED',
    "renewalCount" INTEGER NOT NULL DEFAULT 0,
    "issuedByUserId" TEXT NOT NULL,
    "returnedByUserId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "library_loans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "library_books_schoolId_status_idx" ON "library_books"("schoolId", "status");

-- CreateIndex
CREATE INDEX "library_books_schoolId_title_idx" ON "library_books"("schoolId", "title");

-- CreateIndex
CREATE INDEX "library_book_copies_bookId_idx" ON "library_book_copies"("bookId");

-- CreateIndex
CREATE INDEX "library_book_copies_schoolId_status_idx" ON "library_book_copies"("schoolId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "library_book_copies_schoolId_accessionNumber_key" ON "library_book_copies"("schoolId", "accessionNumber");

-- CreateIndex
CREATE INDEX "library_loans_schoolId_status_idx" ON "library_loans"("schoolId", "status");

-- CreateIndex
CREATE INDEX "library_loans_copyId_idx" ON "library_loans"("copyId");

-- CreateIndex
CREATE INDEX "library_loans_studentId_idx" ON "library_loans"("studentId");

-- CreateIndex
CREATE INDEX "library_loans_staffId_idx" ON "library_loans"("staffId");

-- AddForeignKey
ALTER TABLE "library_book_copies" ADD CONSTRAINT "library_book_copies_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "library_books"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_loans" ADD CONSTRAINT "library_loans_copyId_fkey" FOREIGN KEY ("copyId") REFERENCES "library_book_copies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_loans" ADD CONSTRAINT "library_loans_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_loans" ADD CONSTRAINT "library_loans_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
