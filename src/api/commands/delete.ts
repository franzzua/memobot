import { ChatState } from "../../types";
import { TelegrafApi } from "../telegraf.api";
import {IncomingMessageEvent} from "../../messengers/messenger";
import {getAllText, getText} from "../../helpers/getRandomText";


export async function onDelete(this: TelegrafApi, ctx: IncomingMessageEvent){
    return ctx.reply(getAllText('/delete'), {
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
    const id = await this.bot.deleteLastActiveMessage(ctx.chat.toString());
    if (id == null)
        return ctx.reply(getText('/number', 3));
    const text = getAllText('/last', id.toString());
    return ctx.reply(text);
}

export async function onDeleteNumber(this: TelegrafApi, ctx: IncomingMessageEvent){
    await this.chatDatabase.updateChatState(ctx.chat.toString(), ChatState.deleteMessage)
    return ctx.reply(getText('/number', 0));
}

