import {setChatFromContext} from "./start";
import {TelegrafApi} from "../telegraf.api";
import {IncomingMessageEvent} from "../../messengers/messenger";


export async function stop(this: TelegrafApi, ctx: IncomingMessageEvent) {
    await setChatFromContext.call(this, ctx);
    await this.bot.stop(ctx.chat.toString());
    return ctx.reply(onStopText, {
        reply_markup: {
            remove_keyboard: true
        }
    });
}

export async function resume(this: TelegrafApi, ctx: IncomingMessageEvent) {
    await setChatFromContext.call(this, ctx);
    await this.bot.resume(ctx.chat.toString());
    return ctx.reply("🔔 The bot will now resume sending you reminders", {
            reply_markup: {
                remove_keyboard: true
            }
        }
    );
}
const onStopText = `🔕 You won’t receive any more reminders from the bot for now \n\n`+
                `💡 <em>When you need them again, just use the command</em> <b>/resume</b>`;
