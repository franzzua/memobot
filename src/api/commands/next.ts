import { CommandContext } from "../types";
import { resolve } from "@di";
import { ChatDatabase } from "../../db/chatDatabase";
import { ChatState } from "../../types";
import { TelegrafApi } from "../telegraf.api";
import {TaskSender} from "../../services/task-sender";


export async function next(this: TelegrafApi, ctx: CommandContext){
    const time = await this.bot.dequeueNextTask(ctx.chat.id.toString());
    if (!time) return ctx.reply(`No more tasks...`);
    await resolve(TaskSender).sendTasks(ctx.chat.id.toString(), time);
    await this.bot.enqueueTasks(ctx.chat.id.toString());
    return ctx.reply(`Moved to time ${new Date(time * 1000).toLocaleString()}`);
}


