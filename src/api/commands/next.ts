import {TelegrafApi} from "../telegraf.api";
import {IncomingMessageEvent} from "../../messengers/messenger";


export async function next(this: TelegrafApi, ctx: IncomingMessageEvent){
    const date = await this.bot.getNextMessageTime(ctx.chat.toString());
    if (!date)
        return ctx.reply(`No more tasks...`);
    const state = await this.bot.getTaskState(ctx.chat.toString(), date);
    if (!state.unprocessed.length)
        return ctx.reply(`No more tasks...`);
    await this.sendTasks(ctx.chat.toString(), state);
    const lastDate = new Date(Math.max(...state.unprocessed.map(x => +x.date)));
    await state.markProcessed();
    return ctx.reply(`Moved to time ${lastDate.toLocaleString()}`);
}



