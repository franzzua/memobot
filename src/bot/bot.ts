import {ChatDatabase} from "../db/chatDatabase";
import {inject, singleton} from "@di";
import {Timetable, TimetableDelay} from "./timetable";
import {Scheduler} from "../scheduler/scheduler";
import {Message} from "../types";
import {TaskScheduler} from "../db/task.scheduler";
import {TimetablePolicyType} from "../scheduler/types";

@singleton()
export class MemoBot {
    @inject(ChatDatabase)
    private accessor db!: ChatDatabase;
    @inject(TaskScheduler)
    private accessor scheduler!: Scheduler<Message>
    constructor() {
    }
    public async addMessage(content: string, details: string, chatId: string, userId: string | number): Promise<number> {
        const currentTime = +new Date();
        const dates = Timetable.map(t => new Date(currentTime + t.time * 1000));
        const maxNumber = await this.db.getMaxNumber(chatId);
        await this.scheduler.schedule(chatId, {
            id: `message.${maxNumber}`,
            content, details, createdAt: new Date(),
            type: TimetablePolicyType.Dates,
            dates,
            number: maxNumber + 1
        });
        return maxNumber + 1;
    }

    public async getTaskState(chatId: string, date: Date){
        return await this.scheduler.getTaskState(chatId, new Date(+date + TimetableDelay / 2 * 1000));
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
        await this.db.removeAllMessages(chatId);
    }

    async deleteLastActiveMessage(chatId: string): Promise<number> {
        const maxNumber = await this.db.getMaxNumber(chatId);
        await this.db.deleteMessage(chatId, maxNumber);
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
        return this.db.getNextTimetableTime(chatId);
    }
}
