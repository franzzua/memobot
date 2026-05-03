-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'memo';
ALTER TABLE "Message" ADD COLUMN     "refId" TEXT;

-- CreateIndex
CREATE INDEX "Message_chatId_kind_idx" ON "Message"("chatId", "kind");

-- AlterTable
ALTER TABLE "Chat" ADD COLUMN     "seenQuizIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
