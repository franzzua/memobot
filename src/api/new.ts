import { resolve } from "@di";
import { MemoBot } from "../bot/bot";
import { TaskDatabase } from "../db/taskDatabase";
import { CommandContext } from "./types";
import { setChatFromContext } from "./start";

const bot = resolve(MemoBot);
const db = resolve(TaskDatabase);
const chatState = new Map<number, any>();

const replyMessages = [
    "Add an item that you want to learn: a word, function, formula, fact, password, year, etc.",
    "Add an item that you want to learn: a word, function, formula, fact, password, etc.",
    "Add an item that you want to learn: a word, function, formula, fact, etc.",
    "Add an item you want to learn: a word, function, formula, etc.",
    "Add an item you want to learn: a word, function, etc.",
    "Add an item you want to learn: a word, etc.",
    "Add an item to learn",
    "Add an item",
];
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

export async function onNewCommand(ctx: CommandContext) {
    try {
        await setChatFromContext(ctx);
        const count = await db.getMessageCount(ctx.chat.id.toString());
        const reply = replyMessages[count] ?? replyMessages.at(-1);
        const state = chatState.get(ctx.chat.id) ?? {};
        state.new = 'content';
        chatState.set(ctx.chat.id, state);
        return ctx.reply(reply);
    }catch (e: any){
        return ctx.reply(e.message);
    }
}

export async function onAnyMessage(ctx: CommandContext){
    try {
        const state = chatState.get(ctx.chat.id) ?? {};
        switch (state.new) {
            case 'content': {
                state.newMessage = ctx.message.text;
                state.new = 'details';
                const count = await db.getMessageCount(ctx.chat.id.toString());
                const reply = replyDetails[count] ?? replyDetails.at(-1);
                chatState.set(ctx.chat.id, state);
                return ctx.reply(reply);
            }
            case 'details': {
                const number = await bot.addMessage(state.newMessage, ctx.message.text, ctx.chat.id.toString());
                delete state.new;
                delete state.newMessage;
                chatState.set(ctx.chat.id, state);
                return ctx.reply(`Entry #${number} added`);
            }
        }
    }catch (e){
        console.error(e);
        return ctx.reply(`Failed to add message`);
    }
}