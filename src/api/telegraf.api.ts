import process from "node:process";
import { Telegraf } from "telegraf";
import { inject, singleton } from "@di";
import { MemoBot } from "../bot/bot";
import { onNewCommand } from "./new";
import { onStart } from "./start";
import { onResume, onStop } from "./stop-resume";
import { onDelete, onDeleteLast, onDeleteNumber } from "./delete";
import { ChatState, Task } from "../types";
import { TaskDatabase } from "../db/taskDatabase";
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
    private bot!: MemoBot;
    @inject(TaskDatabase)
    private db!: TaskDatabase;
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
        if (!hook || !hook.url?.startsWith(process.env.PUBLIC_URL!)){
            await this.telegram.setWebhook(this.hookURL);
            this.logger.info(`New instance created a cluster, secret: ${this.secretPath.substring(0, 6)}…`);
        } else if (hook.url) {
            this.secretPath = hook.url.replace(`${process.env.PUBLIC_URL}/${this.path}?secret=`,'');
            this.logger.info(`New instance joined to cluster, secret: ${this.secretPath.substring(0, 6)}…`);
        }
        await this.init();
    }

    async init() {
        this.command('new', onNewCommand);
        this.command('stop', onStop);
        this.command('resume', onResume);
        this.command('start', onStart);
        this.command('delete', onDelete);
        this.command('last', onDeleteLast);
        this.command('number', onDeleteNumber);
        this.command('list', onList);
        this.command('current', onListCurrent);
        this.command('complete', onListComplete);
        this.command('practice', onPractice);
        this.command('donate', onDonate);
        this.command('ai', ai);
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
        this.hears(/^[^/].*/, onAnyMessage);
        // await this.launch();
    }

    async [Symbol.asyncDispose](){
        this.stop();
    }

    public hook = (req: {body: any}) => this.handleUpdate(req.body);

    public async sendTask(task: Task) {
        const isActive = await this.db.checkMessageActive(task.chatId, task.messageId);
        if (!isActive)
            return;
        const timetable = Timetable[task.index];
        if (timetable.skipMessage)
            return;
        const message = `<strong>${task.content}</strong>\n\n`+
            `<span class="tg-spoiler">${task.details}</span>\n\n`+
            `#${task.messageId} (${timetable.name})`;
        await this.telegram.sendMessage(+task.chatId, message, {
            parse_mode: "HTML"
        });
    }
}
