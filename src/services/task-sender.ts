import {Task} from "../types";
import {now} from "../bot/timetable";
import {inject, singleton} from "@di";
import {ChatDatabase} from "../db/chatDatabase";
import {Telegraf} from "telegraf";
import process from "node:process";
import {MemoBot} from "../bot/bot";
import {TaskSendHandlers} from "./send-handlers/index";

import {AiModel} from "./ai-model";
import {TextToSpeech} from "./text-to-speech";

@singleton()
export class TaskSender {
    tg = new Telegraf(process.env.BOT_TOKEN!);
    @inject(MemoBot)
    bot!: MemoBot;
    @inject(ChatDatabase)
    db!: ChatDatabase;
    @inject(AiModel)
    ai!: AiModel;
    @inject(TextToSpeech)
    textToSpeech!: TextToSpeech;

    public async sendTasks(chatId: string, time = now()) {
        const isActive = await this.db.checkChatActive(chatId);
        if (!isActive) return true;
        return await this.db.useTasks(chatId, async tasks => {
            for (let task of tasks) {
                const skipNotification = task !== tasks.at(-1);
                await this.sendTask(task, skipNotification);
            }
        }, time);
    }

    public async sendTask(task: Task, skipNotification: boolean = false){
        const message = await this.db.getMessage(task.chatId, task.messageId);
        if (!message) return;
        await TaskSendHandlers[task.index].call(this, task, skipNotification);
        await this.db.increaseProgress(task.chatId, task.messageId);
    }
}


