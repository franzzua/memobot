import { CommandContext } from "./types";
import { TelegrafApi } from "./telegraf.api";

export async function onPractice(this: TelegrafApi, ctx: CommandContext){
    return ctx.reply('🧑‍🏫 Book a lesson with @spixenglish')
}
