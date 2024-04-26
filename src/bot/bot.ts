import { ChatState, Task } from "../types";
import { TaskDatabase } from "../db/taskDatabase";
import { inject, singleton } from "@di";
import { Timetable } from "./timetable";
import { TaskQueue } from "../db/taskQueue";

@singleton()
export class MemoBot {
    @inject(TaskDatabase)
    private db!: TaskDatabase;
    @inject(TaskQueue)
    private queue!: TaskQueue;

    public min = 100;
    public hour = () => 60 * this.min;
    public day = () => 24*this.hour();
    public week = () => 7*this.day();
    public month = () => 4*this.week();
    public repeatDurations = [
        42*this.min,
        24*this.hour(),
        42*this.hour(),
        this.week(),
        2*this.week(),
        this.month(),
        2*this.month()
    ];


    // private async cancelLastMessage(){
    //     if (!this.lastMessage) return;
    //     await this.queue.deleteMessage(this.lastMessage.messageId, this.lastMessage.popReceipt).catch();
    // }

    // private async runNextTask(){
    //     this.nextTask = await this.db.getNextTask();
    //     if (!this.nextTask) {
    //         console.log(`No task left, going to sleep...`);
    //         return;
    //     }
    //     if (this.isDisposed) return;
    //     await this.sendMessage([this.nextTask], +this.nextTask.date - +new Date());
    // }


    public async addMessage(content: string, details: string, chatId: string): Promise<number> {
        const message = {
            content,
            details,
            chatId,
        }
        const id = await this.db.addMessage(message);
        for (let task of Timetable) {
            await this.queue.sendTask({
                id, content, details, chatId, name: task.name
            }, task.time)
        }
        return id;
    }

    async [Symbol.asyncDispose]() {
    }

    async stop(chatId: string) {
        console.log('stop', chatId);
        await this.db.updateChatState({id: chatId, state: ChatState.paused});
    }

    async resume(chatId: string) {
        console.log('resume', chatId);
        await this.db.updateChatState({id: chatId, state: ChatState.initial});
    }

}
