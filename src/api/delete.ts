import { CommandContext } from "./types";
import { resolve } from "@di";
import { TaskDatabase } from "../db/taskDatabase";
import { ChatState } from "../types";


export async function onDelete(ctx: CommandContext){
    return ctx.reply('🗑️ Choose an item to delete', {
        reply_markup: {
            keyboard: [
                [
                    {text: '/last'},
                    {text: '/number'},
                ]
            ],
            resize_keyboard: true,
            one_time_keyboard: true
        }
    });
}

const db = resolve(TaskDatabase);

export async function onDeleteLast(ctx: CommandContext){
    const id = await db.deleteLastActiveMessage(ctx.chat.id.toString());
    if (id == null)
        return ctx.reply(`⚠️ There are no items to delete`);
    return ctx.reply(`❌ Entry #${id} deleted`);
}

export async function onDeleteNumber(ctx: CommandContext){
    await db.updateChatState(ctx.chat.id.toString(), ChatState.deleteMessage)
    return ctx.reply(`#️⃣ Type in the number of the entry`);
}

