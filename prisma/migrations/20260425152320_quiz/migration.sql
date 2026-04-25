-- AlterTable
ALTER TABLE "Word" ADD COLUMN     "satFrequency" INTEGER;

-- CreateTable
CREATE TABLE "Quiz" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "table_md" TEXT,
    "attachment" BYTEA,
    "answers" JSONB NOT NULL,
    "correct" INTEGER NOT NULL,
    "index" INTEGER NOT NULL,

    CONSTRAINT "Quiz_pkey" PRIMARY KEY ("id")
);
