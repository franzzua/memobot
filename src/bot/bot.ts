import {ChatsDatabase} from "../db/chatsDatabase";
import {inject, singleton} from "@di";
import {Timetable, TimetableDelay} from "./timetable";
import {Scheduler} from "../scheduler/scheduler";
import {Message} from "../types";
import {TaskScheduler} from "../db/task.scheduler";
import {TimetablePolicyType} from "../scheduler/types";

@singleton()
export class MemoBot {
    @inject(ChatsDatabase)
    private accessor db!: ChatsDatabase;
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
            number: maxNumber + 1,
            deleted: false
        });
        return maxNumber + 1;
    }

    public async getTaskState(chatId: string, date: Date){
        return await this.scheduler.getTaskState(chatId, new Date(+date + TimetableDelay / 2 * 1000));
    }

    async [Symbol.asyncDispose]() {
    }

    async stop(chatId: string) {
        await this.db.setIsPaused(chatId, true);
        // TODO: stop
    }

    async resume(chatId: string) {
        // TODO: resume
        console.log('resume', chatId);
        await this.db.setIsPaused(chatId, false);
    }

    async deleteAllMessages(chatId: string) {
        await this.db.removeAllMessages(chatId);
    }


    async getMessages(chatId: string, isActive: boolean): Promise<Message[]> {
        const allMessages = await this.db.getAllMessages(chatId, isActive);
        return allMessages.filter(x => !x.deleted);
    }

    async deleteLastActiveMessage(chatId: string): Promise<number> {
        const maxNumber = await this.db.getMaxNumber(chatId);
        return this.deleteMessage(chatId, maxNumber);
    }

    async deleteMessage(chatId: string, number: number) {
        await this.db.deleteMessage(chatId, number);
        await this.scheduler.unschedule(chatId, `message.${number - 1}`);
        return number;
    }

    getNextMessageTime(chatId: string) {
        return this.db.getNextTimetableTime(chatId);
    }
}
