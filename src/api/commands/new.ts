import { resolve } from "@di";
import { ChatDatabase } from "../../db/chatDatabase";
import { setChatFromContext } from "./start";
import { ChatState } from "../../types";
import { TelegrafApi } from "../telegraf.api";
import {IncomingMessageEvent} from "../../messengers/messenger";
import {getRandomText} from "../../helpers/getRandomText";

const db = resolve(ChatDatabase);

export async function onNewCommand(this: TelegrafApi, ctx: IncomingMessageEvent) {
    const message = await ctx.text();
    if (!message) return;
    const [, content, details] = message.text.split(' ');
    if (content && details){
        const number = await this.bot.addMessage(content, details, ctx.chat.toString(), ctx.user.id);
        return ctx.reply(`✅ Entry #${number} added`);
    }
    await setChatFromContext.call(this, ctx);
    const count = await db.getIdCounter(ctx.chat.toString());
    const reply = getRandomText('/new', ctx.user.id, count);
    await db.updateChatState(ctx.chat.toString(), ChatState.addNew);
    return ctx.reply(reply);
}
