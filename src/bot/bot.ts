import { ChatState, Task } from "../types";
import { TaskDatabase } from "../db/taskDatabase";
import { inject, singleton } from "@di";
import { QueueSendMessageResponse, QueueServiceClient } from "@azure/storage-queue";
import { Timetable } from "./timetable";
import { v4 as uuid } from "uuid";

@singleton()
export class MemoBot {
    @inject(TaskDatabase)
    private db!: TaskDatabase;

    private queueServiceClient = QueueServiceClient.fromConnectionString(process.env.QUEUE_CONNECTION_STRING!);
    private queue = this.queueServiceClient.getQueueClient(process.env.QUEUE_NAME!)

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

    private lastMessage: QueueSendMessageResponse | null = null;
    private async sendMessage(task: Task, timeout = 0) {
        this.lastMessage = await this.queue.sendMessage(JSON.stringify(task), {
            visibilityTimeout: Math.round(timeout),
            messageTimeToLive: -1,
        });
        // for (let task of tasks) {
        //     await this.db.updateTaskState({
        //         id: task.id,
        //         state: TaskState.pending
        //     });
        // }
    }
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
        const id = uuid();
        const message = {
            content,
            details,
            chatId,
            createdAt: new Date(),
            id
        }
        const number = await this.db.addMessage(message);
        for (let task of Timetable) {
            await this.sendMessage({
                number, content, details, chatId, name: task.name
            }, task.time)
        }
        return number;
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
