import { TelegrafApi } from "../telegraf.api";
import {IncomingMessageEvent} from "../../messengers/messenger";
import {getAllText} from "../../helpers/getRandomText";

export async function practice(this: TelegrafApi, ctx: IncomingMessageEvent){
    return ctx.reply(getAllText('/practice'))
}
