import {Telegraf} from "telegraf";
import * as process from "node:process";
import {MemoBot, TasksEvent} from "./bot";
import {TaskStore} from "./task.store";

if (!process.env.BOT_TOKEN)
    throw new Error(`BOT_TOKEN is not defined`);
if(!process.env.PUBLIC_URL)
    throw new Error(`WEBHOOK_ADDRESS is not defined`);
console.log(`
    RUN bot '${process.env.BOT_TOKEN}'
    ON ${process.env.PUBLIC_URL}
`)
export const telegraf = new Telegraf(process.env.BOT_TOKEN, {
    telegram: { webhookReply: true },
});

const store = new TaskStore();
const bot = new MemoBot(store);

telegraf.telegram.setWebhook(`${process.env.PUBLIC_URL}/api/telegraf/${telegraf.secretPathComponent()}`)
// bot.command('oldschool', (ctx) => ctx.reply('Hello'))
telegraf.command('menu', Telegraf.reply('λ'))
// bot.start((ctx) => ctx.reply('Welcome'))
// bot.help((ctx) => ctx.reply('Send me a sticker'))
// bot.on(message('sticker'), (ctx) => ctx.reply('👍'))
telegraf.hears(/^[^/].*/, async (ctx) => {
    const name = ctx.message.from.username
        || [ctx.message.from.last_name, ctx.message.from.first_name].join(' ')
        || ctx.chat.id.toString();
    bot.addMessage(ctx.message.text, ctx.chat.id, name);
});
bot.onTask.addEventListener(TasksEvent.type, (e) => {
    const {tasks, date} = e as TasksEvent;
    for (let {task, message} of tasks) {
        telegraf.telegram.sendMessage(message.chatId, message.message).then(() => {
            store.setTaskState(message, task, 'succeed');
        }).catch(e => {
            store.setTaskState(message, task, 'failed');
        });
    }
})