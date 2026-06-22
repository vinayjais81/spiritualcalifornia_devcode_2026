-- Persona → Stripe Identity migration.
-- The old persona_verifications table only ever held stub rows (Persona was
-- never live — keys were pending), so a clean drop + recreate is safe.

-- DropTable
DROP TABLE IF EXISTS "persona_verifications";

-- CreateTable
CREATE TABLE "identity_verifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "verificationSessionId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "referenceId" TEXT,
    "lastError" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "identity_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "identity_verifications_userId_key" ON "identity_verifications"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "identity_verifications_verificationSessionId_key" ON "identity_verifications"("verificationSessionId");
