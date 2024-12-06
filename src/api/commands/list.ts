import { CommandContext } from "../types";
import { resolve } from "@di";
import { ChatDatabase } from "../../db/chatDatabase";
import { TelegrafApi } from "../telegraf.api";


export async function list(this: TelegrafApi, ctx: CommandContext){
    return ctx.reply('🗒 Please choose a list to view', {
        reply_markup: {
            keyboard: [
                [
                    {text: '/current'},
                    {text: '/complete'},
                ]
            ],
            resize_keyboard: true,
            one_time_keyboard: true
        }
    });
}


export async function onListCurrent(this: TelegrafApi, ctx: CommandContext){
    const messages = await this.db.getMessages(ctx.chat.id.toString(), true);
    if (messages.length == 0)
        return ctx.reply(`⚠️ You haven't added any items to learn yet \n\n💡 <em>Start adding items with</em> <b>/new</b>`,{
            parse_mode: 'HTML'
        });
    const msgList = messages.map(x => `#${x.id} ${x.content}`).join('\n')
    return ctx.reply(`⏳ Here are the items you're currently learning:\n\n`+msgList);
}

export async function onListComplete(this: TelegrafApi, ctx: CommandContext){
    const messages = await this.db.getMessages(ctx.chat.id.toString(), false);
    if (messages.length == 0)
        return ctx.reply(`⚠️ You haven't learned any items yet \n\n💡 <em>Start learning new items with</em> <b>/new</b>`,{
            parse_mode: 'HTML'
        });
    const msgList = messages.map(x => `#${x.id} ${x.content}`).join('\n')
    return ctx.reply(`⌛ Here's what you've learned so far:\n\n`+msgList);
}
