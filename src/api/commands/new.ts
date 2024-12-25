import { resolve } from "@di";
import { ChatDatabase } from "../../db/chatDatabase";
import { CommandContext } from "../types";
import { setChatFromContext } from "./start";
import { ChatState } from "../../types";
import { TelegrafApi } from "../telegraf.api";

const db = resolve(ChatDatabase);

const replyMessages = [
    "✍️ Add an item that you want to learn: a word, function, formula, fact, password, year, etc.",
    "✍️ Add an item that you want to learn: a word, function, formula, fact, password, etc.",
    "✍️ Add an item that you want to learn: a word, function, formula, fact, etc.",
    "✍️ Add an item you want to learn: a word, function, formula, etc.",
    "✍️ Add an item you want to learn: a word, function, etc.",
    "✍️ Add an item you want to learn: a word, etc.",
    "✍️ Add an item to learn",
    "✍️ Add an item",
];

export async function onNewCommand(this: TelegrafApi, ctx: CommandContext) {
    const [, content, details] = ctx.message.text.split(' ');
    if (content && details){
        const number = await this.bot.addMessage(content, details, ctx.chat.id.toString(), ctx.message.from.id);
        return ctx.reply(`✅ Entry #${number} added`);
    }
    await setChatFromContext.call(this, ctx);
    const count = await db.getIdCounter(ctx.chat.id.toString());
    const reply = replyMessages[count] ?? replyMessages.at(-1);
    await db.updateChatState(ctx.chat.id.toString(), ChatState.addNew);
    return ctx.reply(reply);
}
