import { CommandContext } from "./types";
import { resolve } from "@di";
import { ChatDatabase } from "../db/chatDatabase";
import { TelegrafApi } from "./telegraf.api";


export async function onList(this: TelegrafApi, ctx: CommandContext){
    return ctx.reply('🗒 Choose a list', {
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
        return ctx.reply(`⚠️ You aren't learning any items \n\n💡 <em>Start learning with</em> <b>/new</b>`,{
            parse_mode: 'HTML'
        });
    const msgList = messages.map(x => `#${x.id} ${x.content}`).join('\n')
    return ctx.reply(`⏳ Here’s the list of the items you’re learning:\n\n`+msgList);
}

export async function onListComplete(this: TelegrafApi, ctx: CommandContext){
    const messages = await this.db.getMessages(ctx.chat.id.toString(), false);
    if (messages.length == 0)
        return ctx.reply(`⚠️ You haven't learnt any items \n\n💡 <em>Start learning with</em> <b>/new</b>`,{
            parse_mode: 'HTML'
        });
    const msgList = messages.map(x => `#${x.id} ${x.content}`).join('\n')
    return ctx.reply(`⌛ Here’s the list of the items you’ve learnt:\n\n`+msgList);
}
