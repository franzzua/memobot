import { PrismaClient,Chat, Message, Prisma } from "@prisma/client";
import { singleton } from "@di";
import { ChatState } from "../types";


@singleton()
export class TaskDatabase {
    private client = new PrismaClient();

    addMessage(message: Omit<Message,"number"|"chat">): Promise<number> {
        return this.client.$transaction(async (x) => {
            const number = await this.getMessageCount(message.chatId) + 1;
            await this.client.message.create({
                data: {
                    id: message.id,
                    content: message.content,
                    details: message.details,
                    chatId: message.chatId,
                    createdAt: message.createdAt,
                    number
                }
            });
            return number;
        });
    }

    async addOrUpdateChat(chat: Omit<Chat, "state">) {
        await this.client.chat.upsert({
            create: chat,
            where: {id: chat.id},
            update: {}
        });
    }

    async clear() {
        await this.client.$transaction(async x => {
            await x.message.deleteMany();
            await x.chat.deleteMany();
        })
    }

    getMessageCount(chatId: string) {
        return this.client.message.count({
            where: { chatId }
        });
    }

    async updateChatState(chat: Pick<Chat, "id" | "state">) {
        return this.client.chat.update({
            where: {id: chat.id},
            data: {state: chat.state},
        });
    }

    async getChatState(chatId: string): Promise<ChatState>{
        return this.client.chat.findUnique({
            where: {id: chatId},
            select: {state: true}
        }).then(x => x!.state as ChatState);
    }
}
