import { CommandContext } from "./types";
import { resolve } from "@di";
import { TaskDatabase } from "../db/taskDatabase";
import { ChatState } from "../types";


export async function onDelete(ctx: CommandContext){
    return ctx.reply('Delete actions', {
        reply_markup: {
            keyboard: [
                [
                    {text: '/del_last'},
                    {text: '/del_number'},
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
        return ctx.reply(`You have not items to delete`);
    return ctx.reply(`Entry #${id} deleted`);
}

export async function onDeleteNumber(ctx: CommandContext){
    await db.updateChatState(ctx.chat.id.toString(), ChatState.deleteMessage)
    return ctx.reply(`Type in the number of the entry`);
}

