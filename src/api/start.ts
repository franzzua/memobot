import { Context } from "telegraf";
import { resolve } from "@di";
import { TaskDatabase } from "../db/taskDatabase";
import { CommandContext } from "./types";

const db = resolve(TaskDatabase);

const start = `
Ever tried to learn a foreign word, a programming function, or the name of that guy from the party, only to forget it forever within a week?
I get it. Luckily, there's a way to recall anything you need in the long term with close to 100% certainty.

Just <b>type</b> it in the chat, <b>send</b> it, and <b>receive</b> reminders at 7 intervals:
 • 42 minutes
 • 24 hours
 • 42 hours
 • 1 week
 • 2 weeks
 • 1 month
 • 3 months

Use the bot commands to:
<b>/new</b> — add an item that you want to learn and provide any useful information to recall it later: the definition, explanation, rule, translation, example, or link;
<b>/actions</b> — stop or continue receiving reminders, delete entries, or show lists of items you’ve added so far;
<b>/practice</b> — book a lesson to practise English, programming, design, etc.;
<b>/donate</b> — support our current and future education projects.

Easy memorisation is just a click away.
Enjoy your <a href="https://en.wikipedia.org/wiki/Spaced_repetition">spaced repetition</a> trainer!
`;

export async function onStart(ctx: CommandContext) {
    await setChatFromContext(ctx);
    return ctx.reply(start, {parse_mode: 'HTML'})
}

export async function setChatFromContext(ctx: CommandContext){
    const name = ctx.message.from.username
        || [ctx.message.from.last_name, ctx.message.from.first_name].join(' ')
    const chat = {
        id: ctx.chat.id.toString(),
        userId: ctx.message.from.id.toString(),
        username: name,
    }
    await db.addOrUpdateChat(chat);
}