import process from "node:process";
import {inject, singleton} from "@cmmn/core";
import {MemoBot} from "../bot/bot";
import {callbacks, commands} from "./commands/index";
import {Messenger} from "../messengers/messenger";
import {onAnyMessage} from "./commands/onAnyMessage";
import {Message} from "../types";
import {TaskHandle} from "../scheduler/scheduler";
import {TaskSendHandlers} from "../services/send-handlers/index";
import {WordSendHandlers, ensureSatQuiz} from "../services/word-send-handlers";
import type {Word} from "../../prisma/client";
import {Logger} from "../logger/logger";
import {PrismaStorage} from "../db/prismaStorage";
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
    @inject(PrismaStorage)
    chatDatabase!: PrismaStorage;
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
                            await this.messenger.send(chatId, content, {disable_notification: skipNotification});
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

    // Part 2 of the SRS plan (post-peak): quiz the user on a word they've already learned
    // with a SAT-style fill-in-the-blank, cached per word. Falls back to the seeded SAT
    // test bank only when no learned word is available to build one from.
    private async sendNextQuiz(chatId: string, skipNotification: boolean): Promise<void> {
        const word = await this.pickLearnedWord(chatId);
        if (word) {
            const sat = await ensureSatQuiz(chatId, word);
            if (sat) {
                const payloads = renderQuiz({
                    id: '', index: 0, table_md: null, attachment: null,
                    question: sat.question, answers: sat.answers, correct: sat.correct,
                } as any);
                return this.sendPayloads(chatId, payloads, skipNotification);
            }
        }

        const quiz = await this.chatDatabase.getNextUnseenQuiz(chatId)
            ?? await this.chatDatabase.getRandomQuiz();
        if (!quiz) return;
        await this.chatDatabase.appendSeenQuiz(chatId, quiz.id);
        return this.sendPayloads(chatId, renderQuiz(quiz), skipNotification);
    }

    private async sendPayloads(chatId: string, payloads: any[], skipNotification: boolean): Promise<void> {
        for (let j = 0; j < payloads.length; j++) {
            const isLast = j === payloads.length - 1;
            await this.messenger.send(chatId, payloads[j] as any, {
                disable_notification: skipNotification || !isLast,
            });
        }
    }

    // Picks a random word the user has already been introduced to, to quiz them on.
    private async pickLearnedWord(chatId: string): Promise<Word | null> {
        const state = await this.chatDatabase.getPlanState(chatId);
        if (!state) return null;
        const introducedCount = await this.chatDatabase.countMessagesByKind(chatId, 'word');
        const introducedIds = state.wordOrder.slice(0, Math.max(0, introducedCount));
        if (introducedIds.length === 0) return null;
        const id = introducedIds[Math.floor(Math.random() * introducedIds.length)];
        return (await resolve(WordsDatabase).getByIds([id])).get(id) ?? null;
    }
}
