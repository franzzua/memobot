import { CommandContext } from "./types";
import { ChatState } from "../types";
import { resolve } from "@di";
import { ChatDatabase } from "../db/chatDatabase";
import { MemoBot } from "../bot/bot";
import { TelegrafApi } from "./telegraf.api";


const replyDetails = [
    "📝 Add item details: the definition, explanation, rule, example, translation, link, etc.",
    "📝 Add item details: the definition, explanation, rule, example, translation, etc.",
    "📝 Add item details: the definition, explanation, rule, example, etc.",
    "📝 Add item details: the definition, explanation, rule, etc.",
    "📝 Add item details: the definition, explanation, etc.",
    "📝 Add item details: the definition, etc.",
    "📝 Add item details",
    "📝 Add details",
];

export async function onAnyMessage(this: TelegrafApi, ctx: CommandContext) {
    const { state, stateData } = await this.db.getChatState(ctx.chat.id.toString());
    switch (state) {
        case ChatState.deleteMessage:
            const id = +ctx.message.text;
            if (!Number.isFinite(id))
                return ctx.reply(`#️⃣ Type in the number of the entry`);
            const isSuccess = await this.db.deleteMessage(ctx.chat.id.toString(), id);
            if (!isSuccess){
                return ctx.reply(`⚠️ Entry #${id} not found. Type in the number of an existing entry \n\n`+
                    `💡 <em>Find the item in your list with</em> <b>/current</b> <em>or</em> <b>/complete</b>`,{
                        parse_mode: 'HTML'
                });
            }
            await this.db.updateChatState(ctx.chat.id.toString(), ChatState.initial);
            return ctx.reply(`❌ Entry #${id} deleted`);
        case ChatState.addNew: {
            const content = ctx.message.text;
            await this.db.updateChatState(ctx.chat.id.toString(), ChatState.setDetails, { content });
            const count = await this.db.getIdCounter(ctx.chat.id.toString());
            const reply = replyDetails[count] ?? replyDetails.at(-1);
            return ctx.reply(reply);
        }
        case ChatState.setDetails: {
            const number = await this.bot.addMessage(stateData.content, ctx.message.text, ctx.chat.id.toString(), ctx.message.from.id);
            await this.db.updateChatState(ctx.chat.id.toString(), ChatState.initial);
            return ctx.reply(`✅ Entry #${number} added`);
        }

    }
}
