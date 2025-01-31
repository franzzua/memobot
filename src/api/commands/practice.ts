import { TelegrafApi } from "../telegraf.api";
import {IncomingMessageEvent} from "../../messengers/messenger";

export async function practice(this: TelegrafApi, ctx: IncomingMessageEvent){
    return ctx.reply('🧑‍🏫 Book a lesson with @spixenglish')
}
