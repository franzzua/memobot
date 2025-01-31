import {TelegrafApi} from "../telegraf.api";
import {IncomingMessageEvent} from "../../messengers/messenger";

export async function wipe(this: TelegrafApi, ctx: IncomingMessageEvent) {
    await this.bot.deleteAllMessages(ctx.chat.toString())
    return ctx.reply(`#️⃣ All data is wiped.`);
}


