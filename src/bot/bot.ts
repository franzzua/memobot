import { ChatDatabase } from "../db/chatDatabase";
import { inject, resolve, singleton } from "@di";
import { day, now, Timetable, TimetableDelay } from "./timetable";
import { TaskQueue } from "../db/taskQueue";
import { Logger } from "../logger/logger";

@singleton()
export class MemoBot {
    @inject(ChatDatabase)
    private accessor db!: ChatDatabase;
    @inject(TaskQueue)
    private accessor queue!: TaskQueue;
    @inject(Logger)
    private accessor logger!: Logger;

    constructor() {
    }
    public async addMessage(content: string, details: string, chatId: string, userId: string | number): Promise<number> {
        const message = {
            content,
            details,
        }
        const id = await this.db.addMessage(chatId, message);

        for (let i = 0; i < Timetable.length; i++){
            let t = Timetable[i];
            await this.db.addTask({
                details, chatId, index: i, userId,
                start: now(),
                messageId: id, content,
                time: now() + t.time
            });
        }

        await this.enqueueTasks(chatId);
        return id;
    }

    public async enqueueTasks(chatId: string) {
        const nextTaskTime = await this.db.getNextTaskTime(chatId);
        if (!nextTaskTime) {
            return;
        }
        let nextTime = Math.min(Math.max(nextTaskTime, TimetableDelay + now()), 30 * day + now());
        const queueInfo = await this.db.getQueueInfo(chatId);
        let isMoved = false;
        if (queueInfo) {
            if (queueInfo.time > now()) {
                if (queueInfo.time <= nextTime + TimetableDelay / 2)
                    return;
                if (!queueInfo.isMoved && queueInfo.time <= nextTime + TimetableDelay) {
                    isMoved = true;
                    nextTime = queueInfo.time + TimetableDelay / 2;
                }
            }
            await this.queue.deleteTask(queueInfo.name);
        }
        const queueTaskName = await this.queue.sendTask(chatId, nextTime - now());
        await this.db.setQueueInfo(chatId, {
            isMoved,
            time: nextTime,
            name: queueTaskName,
        });
        // this.logger.send({
        //     chatId, queueTime: new Date(nextTime * 1000).toISOString(),
        //     in: nextTime - now()
        // });
    }

    public async dequeueNextTask(chatId: string){
        const nextTask = await this.db.getQueueInfo(chatId);
        if (!nextTask) {
            return;
        }
        await this.queue.deleteTask(nextTask.name);
        await this.db.setQueueInfo(chatId, null);
        return nextTask.time;
    }

    async [Symbol.asyncDispose]() {
    }

    async stop(chatId: string) {
        console.log('stop', chatId);
        await this.db.setIsPaused(chatId, true);
    }

    async resume(chatId: string) {
        console.log('resume', chatId);
        await this.db.setIsPaused(chatId, false);
    }

    async deleteAllMessages(chatId: string) {
        const queueInfo = await this.db.getQueueInfo(chatId);
        if (queueInfo) {
            await this.queue.deleteTask(queueInfo.name);
        }
        await this.db.deleteAllMessage(chatId);

    }
}
