import { resolve } from "@di";
import { TaskDatabase } from "../db/taskDatabase";
import { CommandContext } from "./types";
import { MemoBot } from "../bot/bot";

const db = resolve(TaskDatabase);
const bot = resolve(MemoBot);

const onStopText = `You won’t receive any more reminders from the bot for now.
When you need them again, just use the command <b>/resume</b>`;

export async function onStop(ctx: CommandContext){
    await bot.stop(ctx.chat.id.toString());
    return ctx.reply(onStopText, {parse_mode: "HTML"});
}

export async function onResume(ctx: CommandContext){
    await bot.resume(ctx.chat.id.toString());
    return ctx.reply("The bot will now resume sending you reminders");
}