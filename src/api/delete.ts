import { CommandContext } from "./types";


export async function onDelete(ctx: CommandContext){
    return ctx.reply('Delete actions', {
        reply_markup: {
            keyboard: [
                [
                    {text: '/delete-last'},
                    {text: '/delete-number'},
                ]
            ],
            resize_keyboard: true,
            one_time_keyboard: true
        }
    });
}