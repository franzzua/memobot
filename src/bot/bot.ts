import { ChatState, Message, Task } from "../types";
import { TaskDatabase } from "../db/taskDatabase";
import { inject, singleton } from "@di";
import { Timetable } from "./timetable";
import { TaskQueue } from "../db/taskQueue";
import { google } from "@google-cloud/tasks/build/protos/protos";
import tasks = google.cloud.tasks;

@singleton()
export class MemoBot {
    @inject(TaskDatabase)
    private db!: TaskDatabase;
    @inject(TaskQueue)
    private queue!: TaskQueue;

    public async addMessage(content: string, details: string, chatId: string): Promise<number> {
        const message = {
            content,
            details,
        }
        const id = await this.db.addMessage(chatId, message);
        await this.sendTask({
            id, content, details, chatId, index: 0,
            start: Math.round((+new Date())/1000)
        });
        return id;
    }

    public async sendTask(task: Task) {
        if (task.index >= Timetable.length)
            return;
        const delay = Timetable[task.index].time + task.start - +new Date();
        await this.queue.sendTask(task, delay);
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
