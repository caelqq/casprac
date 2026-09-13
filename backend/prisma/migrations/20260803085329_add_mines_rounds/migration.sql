-- CreateTable
CREATE TABLE "MinesRound" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "betCents" INTEGER NOT NULL,
    "totalTiles" INTEGER NOT NULL,
    "minesCount" INTEGER NOT NULL,
    "minePositions" INTEGER[],
    "revealedTiles" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "status" TEXT NOT NULL DEFAULT 'active',
    "currentMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MinesRound_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MinesRound_userId_status_idx" ON "MinesRound"("userId", "status");

-- AddForeignKey
ALTER TABLE "MinesRound" ADD CONSTRAINT "MinesRound_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
