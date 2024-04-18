import { PrismaClient, Task } from "@prisma/client";
import { Chat, Message, TaskState } from "../types";

export class TaskDatabase {
    private client = new PrismaClient();

    async getNextTasks() {
        const select = {
            date: true,
            id: true,
            message: {
                select: {
                    chatId: true,
                    content: true,
                    details: true
                },
            }
        };
        return [
            ...await this.client.task.findMany({
                select,
                where: { state: TaskState.new, date: {lte: new Date()} },
            }),
            await this.client.task.findFirst({
                select,
                orderBy: {date: 'asc'},
                where: { state: TaskState.new, date: {gt: new Date()} },
            })
        ].filter(x => x).map(x => x!);
    }

    async addMessage(message: Message) {
        await this.client.$transaction(async (x) => {
            await this.addChat(message.chat);
            await this.client.message.create({
                data: {
                    id: message.id,
                    content: message.content,
                    details: message.details,
                    chatId: message.chatId,
                    createdAt: message.createdAt,
                }
            });
            await this.client.task.createMany({
                data: message.tasks,
            })
        });
    }

    async addChat(chat: Chat) {
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
}