import { resolve } from "@di";
import { ChatDatabase } from "../../db/chatDatabase";
import { setChatFromContext } from "./start";
import { ChatState } from "../../types";
import { TelegrafApi } from "../telegraf.api";
import {IncomingMessageEvent} from "../../messengers/messenger";

const db = resolve(ChatDatabase);

const replyMessages = [
    "✍️ Add an item that you want to learn: a word, functions, formula, fact, password, year, etc.",
    "✍️ Add an item that you want to learn: a word, functions, formula, fact, password, etc.",
    "✍️ Add an item that you want to learn: a word, functions, formula, fact, etc.",
    "✍️ Add an item you want to learn: a word, functions, formula, etc.",
    "✍️ Add an item you want to learn: a word, functions, etc.",
    "✍️ Add an item you want to learn: a word, etc.",
    "✍️ Add an item to learn",
    "✍️ Add an item",
];

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
    const reply = replyMessages[count] ?? replyMessages.at(-1);
    await db.updateChatState(ctx.chat.toString(), ChatState.addNew);
    return ctx.reply(reply);
}
