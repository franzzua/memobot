import { ChatState } from "../../types";
import { TelegrafApi } from "../telegraf.api";
import {IncomingMessageEvent} from "../../messengers/messenger";


export async function onDelete(this: TelegrafApi, ctx: IncomingMessageEvent){
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


export async function onDeleteLast(this: TelegrafApi, ctx: IncomingMessageEvent){
    const id = await this.db.deleteLastActiveMessage(ctx.chat.toString());
    if (id == null)
        return ctx.reply(`⚠️ There are no items to delete`);
    return ctx.reply(`❌ Entry #${id} has been deleted`);
}

export async function onDeleteNumber(this: TelegrafApi, ctx: IncomingMessageEvent){
    await this.db.updateChatState(ctx.chat.toString(), ChatState.deleteMessage)
    return ctx.reply(`#️⃣ Please enter the entry number`);
}

