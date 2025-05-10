import {resolve} from "@di";
import {TelegrafApi} from "../telegraf.api";
import {TaskSender} from "../../services/task-sender";
import {IncomingMessageEvent} from "../../messengers/messenger";


export async function next(this: TelegrafApi, ctx: IncomingMessageEvent){
    const time = await this.bot.dequeueNextTask(ctx.chat.toString());
    if (!time) return ctx.reply(`No more tasks...`);
    await resolve(TaskSender).sendTasks(this.messenger, ctx.chat.toString(), time);
    await this.bot.enqueueTasks(ctx.chat.toString());
    return ctx.reply(`Moved to time ${new Date(time * 1000).toLocaleString()}`);
}



