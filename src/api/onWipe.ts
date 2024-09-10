import { TelegrafApi } from "./telegraf.api";
import { CommandContext } from "./types";

export async function onWipe(this: TelegrafApi, ctx: CommandContext) {
    await this.bot.deleteAllMessages(ctx.chat.id.toString())
    return ctx.reply(`#️⃣ All data is wiped.`);
}