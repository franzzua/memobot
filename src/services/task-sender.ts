import {Task} from "../types";
import {now} from "../bot/timetable";
import {inject, singleton} from "@di";
import {ChatDatabase} from "../db/chatDatabase";
import {TaskSendHandlers} from "./send-handlers/index";

import {Messenger} from "../messengers/messenger";

@singleton()
export class TaskSender {
    @inject(ChatDatabase)
    private db!: ChatDatabase;

    public async sendTasks(messenger: Messenger, chatId: string, time = now()) {
        const isActive = await this.db.checkChatActive(chatId);
        if (!isActive) return true;
        return await this.db.useTasks(chatId, async tasks => {
            for (let task of tasks) {
                const skipNotification = task !== tasks.at(-1);
                await this.sendTask(messenger, task, skipNotification);
            }
        }, time);
    }

    public async sendTask(messenger: Messenger, task: Task, skipNotification: boolean = false){
        const message = await this.db.getMessage(task.chatId, task.messageId);
        if (!message) return;
        await TaskSendHandlers[task.index].call(messenger, task, skipNotification);
        await this.db.increaseProgress(task.chatId, task.messageId);
    }
}


