import process from "node:process";
import {Context, Telegraf, Types} from "telegraf";
import { Update } from "@telegraf/types";
import { inject, singleton } from "@di";
import { MemoBot } from "../bot/bot";
import { ChatDatabase } from "../db/chatDatabase";
import {Api, Logger} from "telegram";
import { onAnyMessage } from "./commands/onAnyMessage";
import { commands, callbacks }  from "./commands/index";
import {CallbackQuery} from "@telegraf/types/markup";


if (!process.env.BOT_TOKEN)
    throw new Error(`BOT_TOKEN is not defined`);
if(!process.env.PUBLIC_URL)
    throw new Error(`WEBHOOK_ADDRESS is not defined`);

@singleton()
export class TelegrafApi extends Telegraf {
    @inject(MemoBot)
    bot!: MemoBot;
    @inject(ChatDatabase)
    db!: ChatDatabase;
    @inject(Logger)
    private logger!: Logger;

    constructor() {
        super(process.env.BOT_TOKEN!, {
            telegram: { webhookReply: true },
        });
    }

    path = 'telegraf';
    secretPath = this.secretPathComponent();

    public get hookURL(){
        return `${process.env.PUBLIC_URL}/${this.path}?secret=${this.secretPath}`;
    }

    async run(){
        const hook = await this.telegram.getWebhookInfo().catch(() => null);
        if (!hook || !hook.url?.startsWith(`${process.env.PUBLIC_URL!}/${this.path}`)){
            await this.telegram.setWebhook(this.hookURL);
            this.logger.info(`New instance created a cluster, secret: ${this.secretPath.substring(0, 6)}…`);
        } else if (hook.url) {
            this.secretPath = hook.url.replace(`${process.env.PUBLIC_URL}/${this.path}?secret=`,'');
            this.logger.info(`New instance joined to cluster, secret: ${this.secretPath.substring(0, 6)}…`);
        }
        await this.init();
    }

    async init() {
        for (let command in commands) {
            this.command(command, commands[command].bind(this));
        }
        this.on('callback_query', this.onCallbackQuery);
        this.command('actions', ctx => {
            ctx.reply('🔽 Choose an action from the menu', {
                reply_markup: {
                    keyboard: [
                        [
                            {text: '/stop'},
                            {text: '/resume'}
                        ],
                        [
                            {text: '/delete'},
                            {text: '/list'}
                        ]
                    ],
                    resize_keyboard: true,
                    one_time_keyboard: true
                }
            });
        });
        this.hears(/^[^/].*/, onAnyMessage.bind(this));
        // await this.launch();
    }

    private onCallbackQuery = (ctx: Context<Update.CallbackQueryUpdate>)=> {
        if ('data' in ctx.update.callback_query) {
            const query = ctx.update.callback_query.data;
            if (query in callbacks) {
                return callbacks[query].call(this, ctx as Context<Update.CallbackQueryUpdate<CallbackQuery.DataQuery>>);
            }
        }
    }

    async [Symbol.asyncDispose](){
        this.stop();
    }

    public hook = (req: {body: any}) => this.handleUpdate(req.body);

    
    private async isSilent(chatId: number, userId: number){
        const chat = await this.telegram.getChatMember(chatId, userId);
    }
}
