import {TelegrafApi} from "../telegraf.api";
import {IncomingMessageEvent} from "../../messengers/messenger";
import {getAllText, getText} from "../../helpers/getRandomText";


export async function list(this: TelegrafApi, ctx: IncomingMessageEvent) {
    return ctx.reply(getAllText('/list'), {
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
    const messages = await this.bot.getMessages(ctx.chat.toString(), true);
    if (messages.length == 0)
        return ctx.reply([
            getText('/current', 1),
            getText('/current', 2),
        ].join('\n'));
    const msgList = messages.map(x => `#${x.number} ${x.content}`).join('\n')
    return ctx.reply(getText('/current', 0) + `\n\n` + msgList);
}

export async function onListComplete(this: TelegrafApi, ctx: IncomingMessageEvent) {
    const messages = await this.bot.getMessages(ctx.chat.toString(), false);
    if (messages.length == 0)
        return ctx.reply([
            getText('/complete', 1),
            getText('/complete', 2),
        ].join('\n'));
    const msgList = messages.map(x => `#${x.number} ${x.content}`).join('\n')
    return ctx.reply(getText('/complete', 0) + `\n\n` + msgList);
}
