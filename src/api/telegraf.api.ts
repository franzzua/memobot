import process from "node:process";
import { Markup, Telegraf } from "telegraf";
import { inject, singleton } from "@di";
import { MemoBot, TasksEvent } from "../bot/bot";
import { onAnyMessage, onNewCommand } from "./new";
import { onStart } from "./start";
import { onResume, onStop } from "./stop-resume";
import { NextTaskData } from "../db/taskDatabase";
import { TaskState } from "../types";
import { FastifyInstance } from "fastify";
import { Api } from "telegram";
import { onDelete } from "./delete";

if (!process.env.BOT_TOKEN)
    throw new Error(`BOT_TOKEN is not defined`);
if(!process.env.PUBLIC_URL)
    throw new Error(`WEBHOOK_ADDRESS is not defined`);

@singleton()
export class TelegrafApi extends Telegraf {
    @inject(MemoBot)
    private bot!: MemoBot;

    constructor() {
        super(process.env.BOT_TOKEN!, {
            telegram: { webhookReply: true },
        });
    }

    run(app: FastifyInstance){
        const secretPath = this.secretPathComponent();
        app.post(`/api/telegraf/${secretPath}`, this.hook);

        this.telegram.setWebhook(`${process.env.PUBLIC_URL}/api/telegraf/${secretPath}`)
        this.init();
        console.log(`
            RUN bot '${process.env.BOT_TOKEN}'
            ON ${process.env.PUBLIC_URL}
        `);
    }

    async init() {
        this.bot.onTask.addEventListener(TasksEvent.type, this.onTaskEvent);
        this.command('new', onNewCommand);
        this.command('stop', onStop);
        this.command('resume', onResume);
        this.command('start', onStart);
        this.command('delete', onDelete);
        this.command('actions', ctx => {
            ctx.reply('Available actions', {
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
        this.launch(() => {
            console.log('launch');
        });
        await this.bot.runMissed();
        await this.bot.runNextTask();
    }

    async [Symbol.asyncDispose](){
        this.bot.onTask.removeEventListener(TasksEvent.type, this.onTaskEvent);
        this.stop();
    }

    public hook = (req: {body: any}) => this.handleUpdate(req.body);
    private onTaskEvent = async (event: Event) => {
        for (let task of (event as TasksEvent).tasks) {
            try{
                await this.telegram.sendMessage(+task.message.chatId, getMessage(task), {
                    parse_mode: "HTML"
                });
                await this.bot.onTaskEnd(task.id, TaskState.succeed);
            } catch(e) {
                await this.bot.onTaskEnd(task.id, TaskState.failed);
            }
        }
    }
}

const taskIndexTitles = [
    '42m', '24h', '42h', '1w', '2w', '1M', '3M'
];
function getMessage(task: NextTaskData){
    return `<strong>${task.message.content}</strong>\n\n`+
        `<span class="tg-spoiler">${task.message.details}</span>\n\n`+
        `#${task.message.number} (${taskIndexTitles[task.index]})`
}