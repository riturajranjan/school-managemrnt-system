-- CreateTable
CREATE TABLE "user_active_contexts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "schoolId" TEXT,
    "roleId" TEXT,
    "branchId" TEXT,
    "academicSessionId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_active_contexts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_active_contexts_userId_key" ON "user_active_contexts"("userId");

-- AddForeignKey
ALTER TABLE "user_active_contexts" ADD CONSTRAINT "user_active_contexts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
