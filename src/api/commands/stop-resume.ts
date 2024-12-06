import { CommandContext } from "../types";
import { setChatFromContext } from "./start";
import { TelegrafApi } from "../telegraf.api";


export async function stop(this: TelegrafApi, ctx: CommandContext){
    await setChatFromContext.call(this, ctx);
    await this.bot.stop(ctx.chat.id.toString());
    return ctx.reply(onStopText, {parse_mode: "HTML", reply_markup: {
        remove_keyboard: true
    }});
}

export async function resume(this: TelegrafApi, ctx: CommandContext){
    await setChatFromContext.call(this, ctx);
    await this.bot.resume(ctx.chat.id.toString());
    return ctx.reply("🔔 The bot will now resume sending you reminders", {
        parse_mode: "HTML",
        reply_markup: {
            remove_keyboard: true
        }}
    );
}
const onStopText = `🔕 You won’t receive any more reminders from the bot for now \n\n`+
                `💡 <em>When you need them again, just use the command</em> <b>/resume</b>`;
