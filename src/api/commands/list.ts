import {TelegrafApi} from "../telegraf.api";
import {IncomingMessageEvent} from "../../messengers/messenger";


export async function list(this: TelegrafApi, ctx: IncomingMessageEvent) {
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


export async function onListCurrent(this: TelegrafApi, ctx: IncomingMessageEvent) {
    const messages = await this.db.getMessages(ctx.chat.toString(), true);
    if (messages.length == 0)
        return ctx.reply(`⚠️ You haven't added any items to learn yet \n\n💡 <em>Start adding items with</em> <b>/new</b>`);
    const msgList = messages.map(x => `#${x.id} ${x.content}`).join('\n')
    return ctx.reply(`⏳ Here are the items you're currently learning:\n\n`+msgList);
}

export async function onListComplete(this: TelegrafApi, ctx: IncomingMessageEvent) {
    const messages = await this.db.getMessages(ctx.chat.toString(), false);
    if (messages.length == 0)
        return ctx.reply(`⚠️ You haven't learned any items yet \n\n💡 <em>Start learning new items with</em> <b>/new</b>`);
    const msgList = messages.map(x => `#${x.id} ${x.content}`).join('\n')
    return ctx.reply(`⌛ Here's what you've learned so far:\n\n` + msgList);
}
