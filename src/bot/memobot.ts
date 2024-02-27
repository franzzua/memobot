import {Telegraf} from "telegraf";
import * as process from "node:process";

if (!process.env.BOT_TOKEN)
    throw new Error(`BOT_TOKEN is not defined`);
if(!process.env.PUBLIC_URL)
    throw new Error(`WEBHOOK_ADDRESS is not defined`);

export const bot = new Telegraf(process.env.BOT_TOKEN, {
    telegram: { webhookReply: true },
});
bot.telegram.setWebhook(`${process.env.PUBLIC_URL}/api/telegraf/${bot.secretPathComponent()}`)
// bot.command('oldschool', (ctx) => ctx.reply('Hello'))
bot.command('menu', Telegraf.reply('λ'))
// bot.start((ctx) => ctx.reply('Welcome'))
// bot.help((ctx) => ctx.reply('Send me a sticker'))
// bot.on(message('sticker'), (ctx) => ctx.reply('👍'))
bot.hears(/.*/, (ctx) => ctx.reply(ctx.message.text));