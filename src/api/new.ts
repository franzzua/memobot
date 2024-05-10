import { resolve } from "@di";
import { TaskDatabase } from "../db/taskDatabase";
import { CommandContext } from "./types";
import { setChatFromContext } from "./start";
import { ChatState } from "../types";

const db = resolve(TaskDatabase);

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

export async function onNewCommand(ctx: CommandContext) {
    await setChatFromContext(ctx);
    const count = await db.getIdCounter(ctx.chat.id.toString());
    const reply = replyMessages[count] ?? replyMessages.at(-1);
    await db.updateChatState(ctx.chat.id.toString(), ChatState.addNew);
    return ctx.reply(reply);
}
