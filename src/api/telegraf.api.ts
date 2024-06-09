import process from "node:process";
import { Telegraf } from "telegraf";
import { inject, singleton } from "@di";
import { MemoBot } from "../bot/bot";
import { onNewCommand } from "./new";
import { onStart } from "./start";
import { onResume, onStop } from "./stop-resume";
import { onDelete, onDeleteLast, onDeleteNumber } from "./delete";
import { ChatState, Task } from "../types";
import { ChatDatabase } from "../db/chatDatabase";
import { Logger } from "telegram";
import { Timetable } from "../bot/timetable";
import { onList, onListComplete, onListCurrent } from "./list";
import { onAnyMessage } from "./onAnyMessage";
import { onPractice } from "./practice";
import { onCallback, onDonate } from "./donate";
import { ai } from "./ai";

if (!process.env.BOT_TOKEN)
    throw new Error(`BOT_TOKEN is not defined`);
if(!process.env.PUBLIC_URL)
    throw new Error(`WEBHOOK_ADDRESS is not defined`);

@singleton()
export class TelegrafApi extends Telegraf {
    onCallback(data: any) {
        throw new Error("Method not implemented.");
    }
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
        this.command('new', onNewCommand.bind(this));
        this.command('stop', onStop.bind(this));
        this.command('resume', onResume.bind(this));
        this.command('start', onStart.bind(this));
        this.command('delete', onDelete.bind(this));
        this.command('last', onDeleteLast.bind(this));
        this.command('number', onDeleteNumber.bind(this));
        this.command('list', onList.bind(this));
        this.command('current', onListCurrent.bind(this));
        this.command('complete', onListComplete.bind(this));
        this.command('practice', onPractice.bind(this));
        this.command('donate', onDonate.bind(this));
        this.command('ai', ai.bind(this));
        this.on('callback_query', onCallback);
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

    async [Symbol.asyncDispose](){
        this.stop();
    }

    public hook = (req: {body: any}) => this.handleUpdate(req.body);

    private async getTaskMessage(task: Task){
        const message = await this.db.getMessage(task.chatId, task.messageId);
        if (!message) return null;
        const timetable = Timetable[task.index];
        return `<strong>${task.content}</strong>\n\n`+
            `<span class="tg-spoiler">${task.details}</span>\n\n`+
            `#${task.messageId} (${timetable.name}) [${task.index + 1}/${Timetable.length}]`;
    }
    
    public async sendTasks(chatId: string){
        const isActive = await this.db.checkChatActive(chatId);
        const isSucceed = isActive ? await this.db.useTasks(chatId, async tasks => {
            if (!tasks.length)
                return;
            const messages = (await Promise.all(tasks.map(t => this.getTaskMessage(t)))).join('\n\n');
            await this.telegram.sendMessage(+chatId, messages, {
                parse_mode: "HTML"
            });
            for (let task of tasks) {
                await this.db.increaseProgress(task.chatId, task.messageId);
            }
        }) : true;
        if (isSucceed) {
            await this.bot.enqueueTasks(chatId);
        }
        return isSucceed
    }
    
    private async isSilent(chatId: number, userId: number){
        const chat = await this.telegram.getChatMember(chatId, userId);
    }
}
