import {Message, MessageOptions, Messenger, MessengerEvents} from "../messenger";
import {Context, Telegraf} from "telegraf";
import process from "node:process";
import type * as tg from "@telegraf/types";
import {Update} from "@telegraf/types";
import {TelegramCallbackEvent, TelegramMessageEvent} from "./telegramMessageEvent";

export class TelegramMessenger extends Messenger {
    name = 'telegram';
    tg = new Telegraf(this.token, {
        telegram: { webhookReply: true },
    });

    constructor(private token: string) {
        super();

    }

    path = 'telegram';
    secretPath = this.tg.secretPathComponent();

    public get hookURL() {
        return `${process.env.PUBLIC_URL}/${this.path}?secret=${this.secretPath}`;
    }

    async init() {
        const hook = await this.tg.telegram.getWebhookInfo().catch(() => null);
        if (!hook || !hook.url?.startsWith(`${process.env.PUBLIC_URL!}/${this.path}`)) {
            await this.tg.telegram.setWebhook(this.hookURL);
            // this.logger.info(`New instance created a cluster, secret: ${this.secretPath.substring(0, 6)}…`);
        } else if (hook.url) {
            this.secretPath = hook.url.replace(`${process.env.PUBLIC_URL}/${this.path}?secret=`, '');
            // this.logger.info(`New instance joined to cluster, secret: ${this.secretPath.substring(0, 6)}…`);
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
        this.tg.hears(/.*/, ((ctx: Context) => {
            switch (ctx.updateType) {
                case "message": {
                    const update = ctx.update as tg.Update.MessageUpdate;
                    const msg = new TelegramMessageEvent(update.message, this);
                    this.emit('message', msg);
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
                });
                break;
        }
    }

    async handle(req, res) {
        if (req.query.secret !== this.secretPath)
            return res.sendStatus(401);
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


    private onCallbackQuery = (ctx: Context<Update.CallbackQueryUpdate>) => {
        this.emit('callback', new TelegramCallbackEvent(ctx.update.callback_query, this))
        // if ('data' in ctx.update.callback_query) {
        //     const query = ctx.update.callback_query.data;
        //     if (query in callbacks) {
        //         return callbacks[query].call(this, ctx as Context<Update.CallbackQueryUpdate<CallbackQuery.DataQuery>>);
        //     }
        // }
    }


}

export type TgCommandContext = Context<Update.MessageUpdate<tg.Message.TextMessage>>;
export type TgAudioContext = Context<Update.MessageUpdate<tg.Message.AudioMessage>>;

