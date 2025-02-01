import {TelegrafApi} from "../telegraf.api";
import {IncomingMessageEvent} from "../../messengers/messenger";

export async function spoiler(this: TelegrafApi, ctx: IncomingMessageEvent) {
    return ctx.reply(`Spoiler:`, {
        spoiler: 'Spoiled text'
    });
}