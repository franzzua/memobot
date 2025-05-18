import process from "node:process";
import {inject, singleton} from "@di";
import {MemoBot} from "../bot/bot";
import {ChatsDatabase} from "../db/chatsDatabase";
import {callbacks, commands} from "./commands/index";
import {Messenger} from "../messengers/messenger";
import {onAnyMessage} from "./commands/onAnyMessage";
import {Message} from "../types";
import {TaskHandle} from "../scheduler/scheduler";
import {TaskSendHandlers} from "../services/send-handlers/index";
import {Logger} from "../logger/logger";


if (!process.env.BOT_TOKEN)
    throw new Error(`BOT_TOKEN is not defined`);
if (!process.env.PUBLIC_URL)
    throw new Error(`WEBHOOK_ADDRESS is not defined`);

@singleton()
export class TelegrafApi {
    @inject(MemoBot)
    accessor bot!: MemoBot;
    @inject(ChatsDatabase)
    chatDatabase!: ChatsDatabase;
    @inject(Logger)
    logger!: Logger;

    @inject(Messenger)
    messenger!: Messenger;

    constructor() {
    }

    isInit = false;

    async init() {
        if (this.isInit) return;
        await this.messenger.init();
        this.messenger.on('message', async e => {
            const text = await e.text();
            if (text?.text?.startsWith('/')) {
                const match = text?.text?.split(/[\s/]/g);
                const command = match?.[1];
                if (command && command in commands) {
                    await commands[command].call(this, e);
                }
            } else {
                await onAnyMessage.call(this, e);
            }
        });
        this.messenger.on('callback', async e => {
            const query = e.data as string;
            if (query in callbacks) {
                return callbacks[query].call(this, e);
            }
        })
        this.isInit = true;
    }


    async invokeTask(chatId: string): Promise<boolean> {
        const state = await this.bot.getTaskState(chatId, new Date());
        if (!state.unprocessed) return true;
        await this.sendTasks(chatId, state);
        await state.markProcessed();
        return true;
    }

    async sendTasks(chatId: string, taskState: TaskHandle<Message>) {
        for (let {data: message, dates} of taskState.unprocessed) {
            for (let i = 0; i < dates.length; i++) {
                let date = dates[i];
                const skipNotification = date !== dates.at(-1);
                const content = await this.logger.measure(
                    () => TaskSendHandlers[message.invokeCounter + i](message),
                    'Generator.'+TaskSendHandlers[message.invokeCounter + i].name
                ) ?? `Failed generate content`;
                await this.messenger.send(chatId, content, {disable_notification: skipNotification});
            }
        }
    }
}
