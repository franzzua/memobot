import {Message, MessageOptions, Messenger, MessengerEvents} from "../messenger";
import {Context, Telegraf} from "telegraf";
import process from "node:process";
import type * as tg from "@telegraf/types";
import {Update} from "@telegraf/types";
import {TelegramCallbackEvent, TelegramMessageEvent} from "./telegramMessageEvent";
import {inject, scoped} from "@cmmn/core";
import {Logger} from "../../logger/logger";

export class TelegramMessenger extends Messenger {
    name = 'telegram';
    // webhookReply must stay off: it would send the first bot API call as the webhook
    // response, closing the request early — on Cloud Functions CPU is throttled to ~0
    // after the response, so any work still running (e.g. plan generation) freezes.
    tg = new Telegraf(this.token, {
        telegram: { webhookReply: false },
    });
    @inject(Logger)
    logger!: Logger;

    constructor(private token: string) {
        super();

    }

    path = 'telegram';
    secretPath = this.tg.secretPathComponent();

    public get hookURL() {
        return `${process.env.PUBLIC_URL}/${this.path}?secret=${this.secretPath}`;
    }

    async init() {
        this.logger.send(`Current hook: ${this.secretPath.substring(0, 6)}...`);
        const hook = await this.tg.telegram.getWebhookInfo().catch(() => null);
        this.logger.send(`Resolved hook: ${hook?.url?.substring(0, hook?.url?.length-50)}...`);
        if (!hook || !hook.url?.startsWith(`${process.env.PUBLIC_URL!}/${this.path}`)) {
            await this.tg.telegram.setWebhook(this.hookURL, {
                drop_pending_updates: true,
            });
            this.logger.send(`New instance created a cluster, secret: ${this.secretPath.substring(0, 6)}…`);
        } else if (hook.url) {
            this.secretPath = hook.url.replace(`${process.env.PUBLIC_URL}/${this.path}?secret=`, '');
            this.logger.send(`New instance joined to cluster, secret: ${this.secretPath.substring(0, 6)}…`);
        }
        // for (let command in commands) {
        //     this.emit('command', {
        //         message: {
        //             type: "text",
        //             text: ''
        //         }
        //     })
        //     // this.tg.command(command, commands[command].bind(this));
        // }
        this.tg.on('callback_query', this.onCallbackQuery);
        // this.tg.command('actions', ctx => {
        //
        // });
        this.tg.hears(/.*/, (async (ctx: Context) => {
            switch (ctx.updateType) {
                case "message": {
                    const update = ctx.update as tg.Update.MessageUpdate;
                    const msg = new TelegramMessageEvent(update.message, this);
                    const handlers = (this as any).listeners?.get('message') ?? [];
                    await Promise.all(handlers.map((h: any) => h.listener(msg)));
                }
            }
        }) as any);
        // await this.launch();
    }


    async send(to: string | number, message: Message | string, options: MessageOptions = {}): Promise<void> {
        if (typeof message === "string")
            message = {type: 'text', text: message};
        const tgOptions = {
            disable_notification: options.disable_notification,
            reply_parameters: {
                message_id: options.replyTo as number
            }
        }
        switch (message.type) {
            case "quiz":
                await this.tg.telegram.sendQuiz(to, message.question, message.answers, message.options);
                break;
            case "image":
                await this.tg.telegram.sendPhoto(to, {
                    source: message.image
                }, {
                    ...tgOptions,
                    caption: message.caption,
                    parse_mode: message.caption ? 'HTML' : undefined,
                });
                break;
            case "text":
                if (options.spoiler)
                    message.text += `\n<span class="tg-spoiler">${options.spoiler}</span>`;
                await this.tg.telegram.sendMessage(to, message.text, {
                    ...tgOptions,
                    parse_mode: 'HTML',
                    reply_markup: options.reply_markup,
                    link_preview_options: {
                        is_disabled: !options.preview_url,
                    },
                });
                break;
            case "audio":
                await this.tg.telegram.sendVoice(to, {
                    source: message.audio,
                }, {
                    ...tgOptions,
                    caption: message.caption,
                    parse_mode: message.caption ? 'HTML' : undefined,
                });
                break;
            case "document":
                await this.tg.telegram.sendDocument(to, {
                    source: message.content,
                    filename: message.filename,
                }, {
                    ...tgOptions,
                    caption: message.caption,
                });
                break;
        }
    }

    async handle(req, res) {
        if (req.query.secret !== this.secretPath) {
            this.logger.send(`Current secret: ${this.secretPath}, but received: ${req.query.secret}`);
            return res.sendStatus(401);
        }
        // if (req.query.task) {
        //     const chatId = req.body;
        //     const isSucceed = await taskSender.sendTasks(chatId);
        //     if (isSucceed) {
        //         await bot.enqueueTasks(chatId);
        //         console.log('secceed, return 204')
        //         return res.sendStatus(204);
        //     } else {
        //         return res.sendStatus(418);
        //     }
        // }
        if (req.body.message) {
            await this.tg.handleUpdate(req.body, res).catch(console.error);
            return;
        }
        if (req.body.callback_query) {
            await this.tg.handleUpdate(req.body, res).catch(console.error);
            return;
        }
        await this.tg.handleUpdate(req.body, res).catch(console.error);
    }


    // Handlers must be awaited so handleUpdate keeps the webhook request open until the
    // work is done — emit() is fire-and-forget and the function gets frozen after replying.
    private onCallbackQuery = async (ctx: Context<Update.CallbackQueryUpdate>) => {
        const event = new TelegramCallbackEvent(ctx.update.callback_query, this);
        const handlers = (this as any).listeners?.get('callback') ?? [];
        await Promise.all(handlers.map((h: any) => h.listener(event)));
    }


}

export type TgCommandContext = Context<Update.MessageUpdate<tg.Message.TextMessage>>;
export type TgAudioContext = Context<Update.MessageUpdate<tg.Message.AudioMessage>>;

