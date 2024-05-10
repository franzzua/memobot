import { CommandContext } from "./types";
import { resolve } from "@di";
import { TaskDatabase } from "../db/taskDatabase";


export async function onList(ctx: CommandContext){
    return ctx.reply('List actions', {
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

const db = resolve(TaskDatabase);

export async function onListCurrent(ctx: CommandContext){
    const messages = await db.getMessages(ctx.chat.id.toString(), true);
    if (messages.length == 0)
        return ctx.reply(`You aren't learning any items, start learning with /new`);
    const msgList = messages.map(x => `#${x.id} ${x.content}`).join('\n')
    return ctx.reply(`Here’s the list of the items you’re learning:\n\n`+msgList);
}

export async function onListComplete(ctx: CommandContext){
    const messages = await db.getMessages(ctx.chat.id.toString(), false);
    if (messages.length == 0)
        return ctx.reply(`You haven't learnt any items, start learning with /new`);
    const msgList = messages.map(x => `#${x.id} ${x.content}`).join('\n')
    return ctx.reply(`Here’s the list of the items you’ve learnt:\n\n`+msgList);
}