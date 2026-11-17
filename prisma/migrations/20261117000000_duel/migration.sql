CREATE TABLE "Duel" (
    "id" TEXT NOT NULL,
    "player0" TEXT NOT NULL,
    "name0" TEXT NOT NULL,
    "player1" TEXT,
    "name1" TEXT,
    "vsBot" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL,
    "state" JSONB NOT NULL,
    "notifications" JSONB,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Duel_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Duel_player0_updatedAt_idx" ON "Duel"("player0", "updatedAt");
CREATE INDEX "Duel_player1_updatedAt_idx" ON "Duel"("player1", "updatedAt");
