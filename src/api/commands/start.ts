import { TelegrafApi } from "../telegraf.api";
import {IncomingMessageEvent} from "../../messengers/messenger";


const startText = `
_Ever tried to learn a foreign word, a programming function, or the name of that guy from the party, only to forget it forever within a week? 🤔_

I get it. Luckily, there's a way to recall anything you need in the long term with close to 100% certainty. 👌

Just *type* it in the chat, *send* it, and *receive* reminders at 7 intervals:
 • 42 minutes
 • 24 hours
 • 42 hours
 • 1 week
 • 2 weeks
 • 1 month
 • 3 months

Use the bot commands to:
*/new* — add an item that you want to learn and provide any useful information that will help you recall it later: the definition, explanation, rule, translation, example, or link;
*/actions* — stop or continue receiving reminders, delete entries, or show lists of items you’ve added so far;
*/practice* — book a lesson to practise what you are learning: English, programming, design, etc.;
*/donate* — support our current and future education projects.

Easy memorisation is just a click away.

_Enjoy your https://en.wikipedia.org/wiki/Spaced_repetition trainer!_ ♻️
`;

export async function start(this: TelegrafApi, ctx: IncomingMessageEvent) {
    await setChatFromContext.call(this, ctx);
    return ctx.reply(startText)
}

export async function setChatFromContext(this: TelegrafApi, ctx: IncomingMessageEvent){
    const chat = {
        id: ctx.chat.toString(),
        userId: ctx.user.id.toString(),
        username: ctx.user.name!,
        messenger: this.messenger.name,
    };
    await this.db.addOrUpdateChat(chat);
}
