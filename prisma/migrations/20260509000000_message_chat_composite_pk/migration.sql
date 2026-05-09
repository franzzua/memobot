ALTER TABLE "Message" DROP CONSTRAINT "Message_pkey";
ALTER TABLE "Message" ADD CONSTRAINT "Message_pkey" PRIMARY KEY ("chatId", "id");
