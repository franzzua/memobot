import { PrismaClient, Task, Chat, Message, Prisma } from "@prisma/client";
import { ChatState, TaskState } from "../types";
import { singleton } from "@di";

const taskInfoSelect: Prisma.TaskSelect = {
    date: true,
    id: true,
    index: true,
    message: {
        select: {
            chatId: true,
            content: true,
            details: true,
            number: true,
        },
    }
};
const taskInfoWhere: Prisma.TaskWhereInput = {
    state: TaskState.new,
    message: {chat: {state: ChatState.initial}}
}

@singleton()
export class TaskDatabase {
    private client = new PrismaClient();

    getMissedTasks(): Promise<Array<NextTaskData>> {
        return this.client.task.findMany({
            select: taskInfoSelect,
            where: {
                ...taskInfoWhere,
                date: {lte: new Date()},
            },
        });
    }
    getNextTask(): Promise<NextTaskData | null> {
        return this.client.task.findFirst({
            select: taskInfoSelect,
            orderBy: {date: 'asc'},
            where: {
                ...taskInfoWhere,
                date: {gt: new Date()}
            },
        });
    }

    addMessage(message: Omit<Message,"number"|"chat">, tasks: Task[]): Promise<number> {
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
            await this.client.task.createMany({
                data: tasks,
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

    async updateTaskState(task: Pick<Task, "id"|"state"> ){
        await this.client.task.update({
            where: { id: task.id },
            data: { state: task.state }
        });
    }

    async clear() {
        await this.client.$transaction(async x => {
            await x.task.deleteMany();
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
}

export type NextTaskData = Pick<Task, "date" | "id" | "index"> & {
    message: Pick<Message, "chatId"|"content"|"details"|"number">
}