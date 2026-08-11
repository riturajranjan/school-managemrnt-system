-- CreateTable
CREATE TABLE "platform_impersonations" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "platformUserId" TEXT NOT NULL,
    "targetTenantId" TEXT NOT NULL,
    "targetSchoolId" TEXT NOT NULL,
    "startedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "platform_impersonations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_impersonations_sessionId_key" ON "platform_impersonations"("sessionId");

-- CreateIndex
CREATE INDEX "platform_impersonations_platformUserId_idx" ON "platform_impersonations"("platformUserId");

-- CreateIndex
CREATE INDEX "platform_impersonations_targetSchoolId_idx" ON "platform_impersonations"("targetSchoolId");

-- AddForeignKey
ALTER TABLE "platform_impersonations" ADD CONSTRAINT "platform_impersonations_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
