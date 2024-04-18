import process from "node:process";
import { Telegraf } from "telegraf";

if (!process.env.BOT_TOKEN)
    throw new Error(`BOT_TOKEN is not defined`);
if(!process.env.PUBLIC_URL)
    throw new Error(`WEBHOOK_ADDRESS is not defined`);
console.log(`
    RUN bot '${process.env.BOT_TOKEN}'
    ON ${process.env.PUBLIC_URL}
`)
export const telegraf = new Telegraf(process.env.BOT_TOKEN, {
    telegram: { webhookReply: true },
});

telegraf.telegram.setWebhook(`${process.env.PUBLIC_URL}/api/telegraf/${telegraf.secretPathComponent()}`)
