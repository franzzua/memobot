import { resolve } from "@di";
import { MemoBot } from "../bot/bot";
import { CommandContext } from "./types";
import { setChatFromContext } from "./start";

const bot = resolve(MemoBot);

export async function onStop(ctx: CommandContext){
    await setChatFromContext(ctx);
    await bot.stop(ctx.chat.id.toString());
    return ctx.reply(onStopText, {parse_mode: "HTML", reply_markup: {
        remove_keyboard: true
    }});
}

export async function onResume(ctx: CommandContext){
    await setChatFromContext(ctx);
    await bot.resume(ctx.chat.id.toString());
    return ctx.reply("🔔 The bot will now resume sending you reminders", {
        parse_mode: "HTML",
        reply_markup: {
            remove_keyboard: true
        }}
    );
}
const onStopText = `🔕 You won’t receive any more reminders from the bot for now \n
💡 <em>When you need them again, just use the command</em> <b>/resume</b>`;
