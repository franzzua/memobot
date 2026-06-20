import process from "node:process";
import {inject, singleton} from "@cmmn/core";
import {MemoBot} from "../bot/bot";
import {callbacks, commands} from "./commands/index";
import {Messenger} from "../messengers/messenger";
import {onAnyMessage} from "./commands/onAnyMessage";
import {Message} from "../types";
import {TaskHandle} from "../scheduler/scheduler";
import {TaskSendHandlers} from "../services/send-handlers/index";
import {WordSendHandlers} from "../services/word-send-handlers";
import {Logger} from "../logger/logger";
import {PrismaSchedulerStorage} from "../db/prismaSchedulerStorage";
import {renderQuiz} from "../services/quiz-render";
import {resolve} from "@cmmn/core";
import {SrsPlanner} from "../services/srs-planner";
import {WordsDatabase} from "../db/wordsDatabase";

const WORD_REPLY_KEYBOARD = {
    keyboard: [
        [{text: 'voice'}, {text: 'example'}, {text: 'image'}, {text: 'skip'}],
        [{text: 'wordQuiz'}, {text: 'satQuiz'}, {text: 'card'}],
    ],
    resize_keyboard: true,
    is_persistent: true,
};

if (!process.env.BOT_TOKEN)
    throw new Error(`BOT_TOKEN is not defined`);
if (!process.env.PUBLIC_URL)
    throw new Error(`WEBHOOK_ADDRESS is not defined`);

@singleton()
export class TelegrafApi {
    @inject(MemoBot)
    accessor bot!: MemoBot;
    @inject(PrismaSchedulerStorage)
    chatDatabase!: PrismaSchedulerStorage;
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
        await state.markProcessed();
        await this.sendTasks(chatId, state);
        return true;
    }

    async sendTasks(chatId: string, taskState: TaskHandle<Message>) {
        let tickFired = false;
        for (let {data: message, dates} of taskState.unprocessed) {
            const kind = message.kind ?? 'memo';
            if (kind === 'tick') {
                tickFired = true;
                continue;
            }
            for (let i = 0; i < dates.length; i++) {
                let date = dates[i];
                const skipNotification = date !== dates.at(-1);
                if (kind === 'memo') {
                    const handler = TaskSendHandlers[message.invokeCounter + i];
                    const content = handler
                        ? await this.logger.measure(() => handler(message), 'Generator.' + handler.name)
                        : null;
                    await this.messenger.send(chatId, content ?? `Failed generate content`, {disable_notification: skipNotification});
                } else if (kind === 'word') {
                    const dateIndex = message.invokeCounter + i;
                    if (dateIndex === 0 || !message.refId) {
                        const text = `<b>${message.content}</b>\n${message.details}`;
                        await this.messenger.send(chatId, text, {
                            disable_notification: skipNotification,
                            reply_markup: WORD_REPLY_KEYBOARD,
                        });
                    } else {
                        const handler = WordSendHandlers[dateIndex - 1];
                        if (!handler) continue;
                        const word = (await resolve(WordsDatabase).getByIds([message.refId])).get(message.refId);
                        if (!word) continue;
                        const content = await this.logger.measure(
                            () => handler({chatId, message, word}),
                            'WordHandler.' + handler.name
                        );
                        if (content) {
                            const items = Array.isArray(content) ? content : [content];
                            for (let k = 0; k < items.length; k++) {
                                const isLast = k === items.length - 1;
                                await this.messenger.send(chatId, items[k] as any, {disable_notification: skipNotification || !isLast});
                            }
                        }
                    }
                } else if (kind === 'quiz') {
                    await this.sendNextQuiz(chatId, skipNotification);
                }
            }
        }
        if (tickFired) {
            await resolve(SrsPlanner).advance(chatId);
        }
    }

    private async sendNextQuiz(chatId: string, skipNotification: boolean): Promise<void> {
        const quiz = await this.chatDatabase.getNextUnseenQuiz(chatId)
            ?? await this.chatDatabase.getRandomQuiz();
        if (!quiz) return;
        await this.chatDatabase.appendSeenQuiz(chatId, quiz.id);
        const payloads = renderQuiz(quiz);
        for (let j = 0; j < payloads.length; j++) {
            const isLast = j === payloads.length - 1;
            await this.messenger.send(chatId, payloads[j] as any, {
                disable_notification: skipNotification || !isLast,
            });
        }
    }
}
