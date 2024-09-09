import { CommandContext } from "./types";
import { resolve } from "@di";
import { ChatDatabase } from "../db/chatDatabase";
import { ChatState } from "../types";
import { TelegrafApi } from "./telegraf.api";


export async function onDelete(this: TelegrafApi, ctx: CommandContext){
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


export async function onDeleteLast(this: TelegrafApi, ctx: CommandContext){
    const id = await this.db.deleteLastActiveMessage(ctx.chat.id.toString());
    if (id == null)
        return ctx.reply(`⚠️ There are no items to delete`);
    return ctx.reply(`❌ Entry #${id} has been deleted`);
}

export async function onDeleteNumber(this: TelegrafApi, ctx: CommandContext){
    await this.db.updateChatState(ctx.chat.id.toString(), ChatState.deleteMessage)
    return ctx.reply(`#️⃣ Please enter the entry number`);
}

