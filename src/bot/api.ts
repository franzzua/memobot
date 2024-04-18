import { Telegraf } from "telegraf";
import { MemoBot, TasksEvent } from "./bot";
import { TaskState } from "../types";
import { telegraf } from "./telegraf";
import { TaskDatabase } from "../db/taskDatabase";

const db = new TaskDatabase();
const bot = new MemoBot(db);

telegraf.command('menu', Telegraf.reply('λ'))

telegraf.command('new', async (ctx) => {
    const name = ctx.message.from.username
        || [ctx.message.from.last_name, ctx.message.from.first_name].join(' ')
        || ctx.chat.id.toString();
    bot.addMessage(ctx.message.text, ctx.chat.id, name);
});

bot.onTask.addEventListener(TasksEvent.type, ((event: TasksEvent) => {
    telegraf.telegram.sendMessage(event.task.message!.chatId, event.task.message!.content).then(() => {
        return db.updateTaskState({
            id: event.task.id,
            state: TaskState.succeed
        });
    }).catch(e => {
        return db.updateTaskState({
            id: event.task.id,
            state: TaskState.failed
        });
    });
}) as any);