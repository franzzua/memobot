CREATE TABLE "SentWordMessage" (
    "chatId" TEXT NOT NULL,
    "messageId" INTEGER NOT NULL,
    "wordId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SentWordMessage_pkey" PRIMARY KEY ("chatId","messageId")
);
