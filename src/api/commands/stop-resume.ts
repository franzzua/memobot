import {setChatFromContext} from "./start";
import {TelegrafApi} from "../telegraf.api";
import {IncomingMessageEvent} from "../../messengers/messenger";
import {getAllText, getRandomText} from "../../helpers/getRandomText";


export async function stop(this: TelegrafApi, ctx: IncomingMessageEvent) {
    await setChatFromContext.call(this, ctx);
    await this.bot.stop(ctx.chat.toString());
    return ctx.reply(getAllText('/stop'), {
        reply_markup: {
            remove_keyboard: true
        }
    });
}

export async function resume(this: TelegrafApi, ctx: IncomingMessageEvent) {
    await setChatFromContext.call(this, ctx);
    await this.bot.resume(ctx.chat.toString());
    return ctx.reply(getAllText('/resume'), {
        reply_markup: {
            remove_keyboard: true
        }
    });
}
