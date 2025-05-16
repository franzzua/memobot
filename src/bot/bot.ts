import {ChatDatabase} from "../db/chatDatabase";
import {inject, singleton} from "@di";
import {Timetable} from "./timetable";
import {Scheduler} from "../scheduler/scheduler";
import {Message} from "../types";
import {TaskScheduler} from "../db/task.scheduler";
import {TimetablePolicyType} from "../scheduler/types";
import {TaskDatabase} from "../db/taskDatabase";

@singleton()
export class MemoBot {
    @inject(ChatDatabase)
    private accessor db!: ChatDatabase;
    @inject(TaskDatabase)
    private accessor taskDatabase!: TaskDatabase;
    @inject(TaskScheduler)
    private accessor scheduler!: Scheduler<Message>
    constructor() {
    }
    public async addMessage(content: string, details: string, chatId: string, userId: string | number): Promise<number> {
        const currentTime = +new Date();
        const dates = Timetable.map(t => new Date(currentTime + t.time * 1000));
        const maxNumber = await this.taskDatabase.getMaxNumber(chatId);
        await this.scheduler.schedule(chatId, {
            id: `message.${maxNumber}`,
            content, details, createdAt: new Date(),
            type: TimetablePolicyType.Dates,
            dates,
            sentCount: 0,
            number: maxNumber + 1
        });
        return maxNumber + 1;
    }
    //
    // public async enqueueTasks(chatId: string) {
    //     const nextTaskTime = await this.db.getNextTaskTime(chatId);
    //     if (!nextTaskTime) {
    //         return;
    //     }
    //     let nextTime = Math.min(Math.max(nextTaskTime, TimetableDelay + now()), 30 * day + now());
    //     const queueInfo = await this.db.getQueueInfo(chatId);
    //     let isMoved = false;
    //     if (queueInfo) {
    //         if (queueInfo.time > now()) {
    //             if (queueInfo.time <= nextTime + TimetableDelay / 2)
    //                 return;
    //             if (!queueInfo.isMoved && queueInfo.time <= nextTime + TimetableDelay) {
    //                 isMoved = true;
    //                 nextTime = queueInfo.time + TimetableDelay / 2;
    //             }
    //         }
    //         await this.queue.deleteTask(queueInfo.name);
    //     }
    //     const queueTaskName = await this.queue.sendTask(chatId, nextTime - now());
    //     await this.db.setQueueInfo(chatId, {
    //         isMoved,
    //         time: nextTime,
    //         name: queueTaskName,
    //     });
    //     // this.logger.send({
    //     //     chatId, queueTime: new Date(nextTime * 1000).toISOString(),
    //     //     in: nextTime - now()
    //     // });
    // }


    public async getTaskState(chatId: string, date: Date){
        return await this.scheduler.getTaskState(chatId, date);
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
        await this.scheduler.removeTask(chatId);
    }

    async deleteLastActiveMessage(chatId: string): Promise<number> {
        // TODO: get last message number
        const maxNumber = await this.taskDatabase.getMaxNumber(chatId);
        await this.taskDatabase.deleteMessage(chatId, maxNumber);
        return maxNumber;
    }

    async getMessages(chatId: string, isActive: boolean): Promise<Message[]> {
        // TODO: get messages
        return [];
    }

    async deleteMessage(chatId: string, id: number) {
        // TODO: get last message number
        return 0;
    }

    getNextMessageTime(chatId: string) {
        return this.taskDatabase.getNextTimetableTime(chatId, new Date());
    }
}
