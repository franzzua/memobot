import { CommandContext } from "./types";
import { ChatState } from "../types";
import { resolve } from "@di";
import { TaskDatabase } from "../db/taskDatabase";
import { MemoBot } from "../bot/bot";

const db = resolve(TaskDatabase);
const bot = resolve(MemoBot);

const replyDetails = [
    "Add item details: the definition, explanation, rule, example, translation, link, etc.",
    "Add item details: the definition, explanation, rule, example, translation, etc.",
    "Add item details: the definition, explanation, rule, example, etc.",
    "Add item details: the definition, explanation, rule, etc.",
    "Add item details: the definition, explanation, etc.",
    "Add item details: the definition, etc.",
    "Add item details",
    "Add details",
];

export async function onAnyMessage(ctx: CommandContext) {
    const { state, stateData } = await db.getChatState(ctx.chat.id.toString());
    switch (state) {
        case ChatState.deleteMessage:
            const id = +ctx.message.text;
            if (!Number.isFinite(id))
                return ctx.reply(`Input number please`);
            const isSuccess = await db.deleteMessage(ctx.chat.id.toString(), id);
            if (!isSuccess){
                return ctx.reply(`Entry #${id} not found, please provide number of existing entry. \n`+
                    `You can check existed items with /current`);
            }
            await db.updateChatState(ctx.chat.id.toString(), ChatState.initial);
            return ctx.reply(`Entry #${id} deleted`);
        case ChatState.addNew: {
            const content = ctx.message.text;
            await db.updateChatState(ctx.chat.id.toString(), ChatState.setDetails, { content });
            const count = await db.getIdCounter(ctx.chat.id.toString());
            const reply = replyDetails[count] ?? replyDetails.at(-1);
            return ctx.reply(reply);
        }
        case ChatState.setDetails: {
            const number = await bot.addMessage(stateData.content, ctx.message.text, ctx.chat.id.toString());
            await db.updateChatState(ctx.chat.id.toString(), ChatState.initial);
            return ctx.reply(`Entry #${number} added`);
        }

    }
}